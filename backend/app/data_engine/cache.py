"""
Cache layer for external API responses — Redis with in-memory fallback.

If Redis is reachable (REDIS_URL set and server running), all cache entries
are stored there so they survive backend restarts and are shared across
multiple workers.  If Redis is not available, the process falls back
transparently to the async in-memory TTLCache.

TTL defaults per data type:
    SCOREBOARD_LIVE      =  2 min   (live matches update frequently)
    SCOREBOARD_SCHEDULED = 30 min   (fixtures don't change often)
    INJURIES             = 15 min   (injury news can break during the day)
    TEAM_FORM            = 60 min   (past results are immutable)
    H2H                  = 60 min   (past results are immutable)
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# ── TTL constants (seconds) ──────────────────────────────────────────────────
TTL_SCOREBOARD_LIVE = 120
TTL_SCOREBOARD_SCHEDULED = 1800
TTL_INJURIES = 900
TTL_TEAM_FORM = 3600
TTL_H2H = 3600


class TTLCache:
    """
    Async-safe in-memory cache with per-entry TTL expiry.

    Keys are plain strings. Expired entries are lazily evicted on read.
    Periodic cleanup runs every 10 minutes to prevent unbounded growth.
    """

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, datetime]] = {}
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    # ── Public API ────────────────────────────────────────────────────────────

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            value, expires_at = entry
            if datetime.utcnow() > expires_at:
                del self._store[key]
                self._misses += 1
                logger.debug("Cache expired: %s", key)
                return None
            self._hits += 1
            logger.debug("Cache hit: %s", key)
            return value

    async def set(self, key: str, value: Any, ttl: int) -> None:
        async with self._lock:
            self._store[key] = (value, datetime.utcnow() + timedelta(seconds=ttl))
            logger.debug("Cache set: %s (TTL=%ds)", key, ttl)

    async def invalidate(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def invalidate_prefix(self, prefix: str) -> int:
        """Remove all keys starting with prefix. Returns count removed."""
        async with self._lock:
            to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in to_delete:
                del self._store[k]
            return len(to_delete)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0

    async def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        now = datetime.utcnow()
        async with self._lock:
            expired = [k for k, (_, exp) in self._store.items() if now > exp]
            for k in expired:
                del self._store[k]
            return len(expired)

    @property
    def stats(self) -> dict[str, int]:
        return {
            "entries": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
        }

    # ── Typed helpers (typed wrappers for common cache keys) ─────────────────

    async def get_injuries(self, team_id: str) -> Any | None:
        return await self.get(f"injuries:{team_id}")

    async def set_injuries(self, team_id: str, value: Any) -> None:
        await self.set(f"injuries:{team_id}", value, TTL_INJURIES)

    async def get_team_form(self, team_id: str, league_slug: str) -> Any | None:
        return await self.get(f"form:{league_slug}:{team_id}")

    async def set_team_form(self, team_id: str, league_slug: str, value: Any) -> None:
        await self.set(f"form:{league_slug}:{team_id}", value, TTL_TEAM_FORM)

    async def get_h2h(self, home_id: str, away_id: str, league_slug: str) -> Any | None:
        return await self.get(f"h2h:{league_slug}:{home_id}:{away_id}")

    async def set_h2h(self, home_id: str, away_id: str, league_slug: str, value: Any) -> None:
        await self.set(f"h2h:{league_slug}:{home_id}:{away_id}", value, TTL_H2H)

    async def get_scoreboard(self, league_slug: str, date_str: str) -> Any | None:
        return await self.get(f"scoreboard:{league_slug}:{date_str}")

    async def set_scoreboard(self, league_slug: str, date_str: str, value: Any, live: bool = False) -> None:
        ttl = TTL_SCOREBOARD_LIVE if live else TTL_SCOREBOARD_SCHEDULED
        await self.set(f"scoreboard:{league_slug}:{date_str}", value, ttl)


# ── Redis cache (optional) ────────────────────────────────────────────────────

class RedisCache:
    """
    Redis-backed cache with the same interface as TTLCache.
    Values are JSON-serialised; pickle is avoided for security.
    """

    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as aioredis  # type: ignore
        self._client = aioredis.from_url(redis_url, decode_responses=True)
        self._hits = 0
        self._misses = 0

    async def get(self, key: str) -> Any | None:
        try:
            raw = await self._client.get(key)
            if raw is None:
                self._misses += 1
                return None
            self._hits += 1
            return json.loads(raw)
        except Exception as exc:
            logger.debug("Redis get failed (%s): %s", key, exc)
            self._misses += 1
            return None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        try:
            await self._client.setex(key, ttl, json.dumps(value, default=str))
        except Exception as exc:
            logger.debug("Redis set failed (%s): %s", key, exc)

    async def invalidate(self, key: str) -> None:
        try:
            await self._client.delete(key)
        except Exception:
            pass

    async def invalidate_prefix(self, prefix: str) -> int:
        try:
            keys = await self._client.keys(f"{prefix}*")
            if keys:
                return await self._client.delete(*keys)
            return 0
        except Exception:
            return 0

    async def clear(self) -> None:
        try:
            await self._client.flushdb()
        except Exception:
            pass

    async def cleanup_expired(self) -> int:
        return 0  # Redis handles expiry natively

    @property
    def stats(self) -> dict[str, int]:
        return {"hits": self._hits, "misses": self._misses}

    # ── Typed helpers (same API as TTLCache) ─────────────────────────────────

    async def get_injuries(self, team_id: str) -> Any | None:
        return await self.get(f"injuries:{team_id}")

    async def set_injuries(self, team_id: str, value: Any) -> None:
        await self.set(f"injuries:{team_id}", value, TTL_INJURIES)

    async def get_team_form(self, team_id: str, league_slug: str) -> Any | None:
        return await self.get(f"form:{league_slug}:{team_id}")

    async def set_team_form(self, team_id: str, league_slug: str, value: Any) -> None:
        await self.set(f"form:{league_slug}:{team_id}", value, TTL_TEAM_FORM)

    async def get_h2h(self, home_id: str, away_id: str, league_slug: str) -> Any | None:
        return await self.get(f"h2h:{league_slug}:{home_id}:{away_id}")

    async def set_h2h(self, home_id: str, away_id: str, league_slug: str, value: Any) -> None:
        await self.set(f"h2h:{league_slug}:{home_id}:{away_id}", value, TTL_H2H)

    async def get_scoreboard(self, league_slug: str, date_str: str) -> Any | None:
        return await self.get(f"scoreboard:{league_slug}:{date_str}")

    async def set_scoreboard(self, league_slug: str, date_str: str, value: Any, live: bool = False) -> None:
        ttl = TTL_SCOREBOARD_LIVE if live else TTL_SCOREBOARD_SCHEDULED
        await self.set(f"scoreboard:{league_slug}:{date_str}", value, ttl)


# ── Module-level singleton — Redis if available, in-memory fallback ───────────

def _build_cache() -> TTLCache | RedisCache:
    """
    Try to connect to Redis.  If the connection probe succeeds within 1 second,
    return a RedisCache.  Otherwise fall back to the in-memory TTLCache.
    """
    import os
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        try:
            from app.config import get_settings
            redis_url = get_settings().REDIS_URL
        except Exception:
            pass

    if not redis_url:
        logger.info("REDIS_URL not set — using in-memory cache")
        return TTLCache()

    import asyncio as _asyncio

    async def _probe(url: str) -> bool:
        try:
            import redis.asyncio as aioredis  # type: ignore
            client = aioredis.from_url(url, socket_connect_timeout=1)
            await asyncio.wait_for(client.ping(), timeout=1.0)
            await client.aclose()
            return True
        except Exception:
            return False

    try:
        loop = _asyncio.get_event_loop()
        if loop.is_running():
            # Can't block — schedule Redis init lazily; use in-memory for now
            logger.info("Event loop running during startup — deferring Redis probe; using in-memory cache")
            return TTLCache()
        reachable = loop.run_until_complete(_probe(redis_url))
    except Exception:
        reachable = False

    if reachable:
        logger.info("Redis reachable at %s — using Redis cache", redis_url)
        return RedisCache(redis_url)
    else:
        logger.info("Redis not reachable — falling back to in-memory cache")
        return TTLCache()


cache: TTLCache | RedisCache = _build_cache()
