"""ESPN API source adapter — single point of contact for all ESPN calls.

All ESPN HTTP calls live here. Methods return raw dicts (validated upstream
by validation.py). Cache integration is handled by callers via cache.py.

ESPN Public API base:
    https://site.api.espn.com/apis/site/v2/sports/soccer/

No API key required. Rate-limiting is handled by the TTL cache so we
never hammer ESPN with redundant requests.

Endpoints used:
    scoreboard    GET /{slug}/scoreboard?dates=YYYYMMDD
    team schedule GET /{slug}/teams/{team_id}/schedule
    injuries      GET /teams/{team_id}/injuries   (no slug needed)
    event summary GET /{slug}/summary?event={event_id}

All methods are async and use a shared httpx.AsyncClient with:
    - Connection timeout: 5s
    - Read timeout: 10s
    - Retries: up to 2 (configurable)
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FootballAI/1.0)",
    "Accept": "application/json",
}
_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
_MAX_RETRIES = 2


async def _get(client: httpx.AsyncClient, url: str, params: dict | None = None) -> dict[str, Any] | None:
    """
    Single GET with retry logic.
    Returns None on failure (caller decides how to handle missing data).
    """
    for attempt in range(1, _MAX_RETRIES + 2):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                if not resp.content:
                    logger.debug("ESPN empty response body: %s", url)
                    return None
                try:
                    return resp.json()
                except Exception:
                    logger.warning("ESPN non-JSON response: %s", url)
                    return None
            if resp.status_code == 400:
                logger.warning("ESPN 400 Bad Request: %s — skipping", url)
                return None
            if resp.status_code == 404:
                logger.debug("ESPN 404: %s", url)
                return None
            if resp.status_code == 429:
                wait = 2 ** attempt
                logger.warning("ESPN rate-limited (429). Waiting %ds...", wait)
                await asyncio.sleep(wait)
                continue
            logger.warning("ESPN HTTP %d: %s", resp.status_code, url)
            return None
        except httpx.TimeoutException:
            logger.warning("ESPN timeout (attempt %d/%d): %s", attempt, _MAX_RETRIES + 1, url)
        except httpx.RequestError as exc:
            logger.warning("ESPN request error (attempt %d/%d): %s — %s", attempt, _MAX_RETRIES + 1, url, exc)
    return None


class ESPNSource:
    """
    Async ESPN API adapter.

    Usage:
        async with ESPNSource() as espn:
            events = await espn.fetch_scoreboard("ENG.1", "20260507")

    Or use the module-level singleton `espn` for one-off calls:
        from app.data_engine.sources.espn import espn
        events = await espn.fetch_scoreboard("ENG.1", "20260507")
    """

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "ESPNSource":
        self._client = httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT)
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError(
                "ESPNSource must be used as an async context manager "
                "or via the module-level `espn` singleton."
            )
        return self._client

    # ── Scoreboard ────────────────────────────────────────────────────────────

    async def fetch_scoreboard(self, league_slug: str, date_str: str) -> list[dict]:
        """
        Fetch all events for a league on a given date.

        Args:
            league_slug: ESPN slug, e.g. "ENG.1", "UEFA.CHAMPIONS"
            date_str:    YYYYMMDD format, e.g. "20260507"

        Returns:
            List of raw event dicts (unvalidated).
        """
        url = f"{_BASE}/{league_slug}/scoreboard"
        data = await _get(self._ensure_client(), url, params={"dates": date_str})
        if data is None:
            return []
        events = data.get("events", [])
        logger.debug("ESPN scoreboard %s %s: %d events", league_slug, date_str, len(events))
        return events

    async def fetch_scoreboard_multi(self, slugs: list[str], date_str: str) -> dict[str, list[dict]]:
        """
        Fetch scoreboards for multiple leagues in parallel.

        Returns dict: {slug: [events]}
        """
        tasks = {slug: self.fetch_scoreboard(slug, date_str) for slug in slugs}
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        output: dict[str, list[dict]] = {}
        for slug, result in zip(tasks.keys(), results):
            if isinstance(result, Exception):
                logger.error("Failed to fetch %s: %s", slug, result)
                output[slug] = []
            else:
                output[slug] = result  # type: ignore[assignment]
        return output

    # ── Team lookup by name ───────────────────────────────────────────────────

    async def find_team_id_by_name(self, team_name: str, league_slug: str) -> str | None:
        """
        Search for a team's ESPN numeric ID by its display name within a league.
        Fetches the league teams list and fuzzy-matches by name.
        Returns None if not found.
        """
        url = f"{_BASE}/{league_slug}/teams"
        data = await _get(self._ensure_client(), url)
        if not data:
            return None

        teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
        name_lower = team_name.lower().strip()

        # Exact match first
        for entry in teams:
            t = entry.get("team", {})
            if t.get("displayName", "").lower() == name_lower:
                return str(t.get("id", ""))

        # Partial match fallback
        for entry in teams:
            t = entry.get("team", {})
            display = t.get("displayName", "").lower()
            short   = t.get("shortDisplayName", "").lower()
            if name_lower in display or display in name_lower or name_lower in short:
                return str(t.get("id", ""))

        return None

    # ── Team schedule / form ──────────────────────────────────────────────────

    async def fetch_team_schedule(self, team_id: str, league_slug: str) -> list[dict]:
        """
        Fetch a team's full season schedule (includes past results and future fixtures).

        Used to derive recent form (last 5 finished matches).
        """
        url = f"{_BASE}/{league_slug}/teams/{team_id}/schedule"
        data = await _get(self._ensure_client(), url)
        if data is None:
            return []
        events = data.get("events", [])
        logger.debug("ESPN schedule %s/%s: %d events", league_slug, team_id, len(events))
        return events

    # ── Injuries ──────────────────────────────────────────────────────────────

    async def fetch_team_injuries(self, team_id: str) -> list[dict]:
        """
        Fetch injury/suspension list for a team.

        ESPN injury endpoint does not require a league slug.
        Returns list of injury item dicts.
        """
        url = f"{_BASE}/teams/{team_id}/injuries"
        data = await _get(self._ensure_client(), url)
        if data is None:
            return []
        injuries = data.get("injuries", [])
        logger.debug("ESPN injuries team %s: %d entries", team_id, len(injuries))
        return injuries

    async def fetch_current_squad_names(self, team_id: str, league_slug: str) -> set[str]:
        """
        Return a set of lowercase player names currently in the squad (ESPN roster).
        Used to filter historical injury data for transferred players.
        """
        url = f"{_BASE}/{league_slug}/teams/{team_id}/roster"
        data = await _get(self._ensure_client(), url)
        if not data:
            return set()
        athletes = data.get("athletes", [])
        names: set[str] = set()
        for a in athletes:
            names.add(a.get("displayName", "").lower())
            names.add(a.get("shortName", "").lower())
            # Also add last name for fuzzy matching (e.g. "De Bruyne" → "de bruyne")
            full = a.get("displayName", "")
            if " " in full:
                names.add(full.split()[-1].lower())
        return names

    # ── Event summary (for detailed match data) ───────────────────────────────

    async def fetch_event_summary(self, event_id: str, league_slug: str) -> dict | None:
        """
        Fetch the full event summary including lineups, stats, timeline.

        Note: lineup data is only available close to kickoff or after the match starts.
        """
        url = f"{_BASE}/{league_slug}/summary"
        data = await _get(self._ensure_client(), url, params={"event": event_id})
        return data

    # ── Standings ─────────────────────────────────────────────────────────────

    async def fetch_standings(self, league_slug: str) -> list[dict]:
        """Fetch current league table standings."""
        url = f"{_BASE}/{league_slug}/standings"
        data = await _get(self._ensure_client(), url)
        if data is None:
            return []
        try:
            groups = data.get("standings", {}).get("entries", [])
            return groups
        except Exception:
            return []


# ── Module-level singleton ────────────────────────────────────────────────────
# For use in FastAPI route handlers (which manage their own event loops).
# Always open/close via context manager or use the helper below.

class _EagerESPNSource(ESPNSource):
    """
    Lazy-init singleton that creates a client on first use and reuses it.
    Suitable for long-running processes (FastAPI server).
    """

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT)
        return self._client

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT)
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None


espn = _EagerESPNSource()


# ── Fantasy Premier League source (free, no key, current season only) ─────────

_FPL_BOOTSTRAP = "https://fantasy.premierleague.com/api/bootstrap-static/"

_FPL_STATUS_MAP = {
    "i": "Injured",
    "d": "Doubtful",
    "s": "Suspended",
    "u": "Unavailable",
    "n": "Not Available",
}

# Team name fragments → FPL team names (for fuzzy matching)
_FPL_NAME_HINTS: dict[str, str] = {
    "manchester city": "Man City",
    "manchester united": "Man Utd",
    "nottingham": "Nott'm Forest",
    "newcastle": "Newcastle",
    "tottenham": "Spurs",
    "aston villa": "Aston Villa",
}


class FPLSource:
    """
    Official Fantasy Premier League bootstrap API.
    Free, no API key, current-season data only.
    Covers Premier League teams only.
    """

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._cache_data: dict | None = None
        self._cache_ts: float = 0.0
        self._cache_ttl: float = 3600.0  # 1 hour

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(15.0))
        return self._client

    async def _bootstrap(self) -> dict:
        import time
        now = time.monotonic()
        if self._cache_data and (now - self._cache_ts) < self._cache_ttl:
            return self._cache_data
        try:
            client = self._ensure_client()
            r = await client.get(_FPL_BOOTSTRAP)
            r.raise_for_status()
            self._cache_data = r.json()
            self._cache_ts = now
            return self._cache_data
        except Exception as exc:
            logger.warning("FPL bootstrap fetch failed: %s", exc)
            return {}

    def _match_team(self, team_name: str, fpl_teams: dict[int, str]) -> int | None:
        """Fuzzy match a team name against FPL team names."""
        lower = team_name.lower().strip()
        # Direct hint
        for hint, fpl_name in _FPL_NAME_HINTS.items():
            if hint in lower:
                for tid, tname in fpl_teams.items():
                    if tname == fpl_name:
                        return tid
        # Exact match
        for tid, tname in fpl_teams.items():
            if tname.lower() == lower:
                return tid
        # Partial
        for tid, tname in fpl_teams.items():
            if lower in tname.lower() or tname.lower() in lower:
                return tid
        return None

    async def fetch_injuries(self, team_name: str) -> list[dict]:
        """
        Return current injured/doubtful/suspended players for a PL team.
        Each item: {name, position, status, news, chance_of_playing, photo}.
        Returns [] for teams not in the Premier League.
        """
        data = await self._bootstrap()
        if not data:
            return []

        fpl_teams = {t["id"]: t["name"] for t in data.get("teams", [])}
        team_id = self._match_team(team_name, fpl_teams)
        if not team_id:
            logger.debug("FPL: no team match for '%s'", team_name)
            return []

        position_map = {et["id"]: et["singular_name"] for et in data.get("element_types", [])}
        transfer_kw = {"loan", "joined", "released", "terminated", "transfer"}
        results: list[dict] = []
        for p in data.get("elements", []):
            if p["team"] != team_id:
                continue
            status = p.get("status", "a")
            if status == "a":
                continue
            news: str = p.get("news") or ""
            # Skip loans / permanent transfers
            news_lower = news.lower()
            if any(kw in news_lower for kw in transfer_kw):
                continue
            # Only include real injury/doubt/suspension
            if status not in ("i", "d", "s"):
                continue
            first = p.get("first_name", "")
            last = p.get("second_name", "")
            results.append({
                "name": f"{first} {last}".strip(),
                "web_name": p.get("web_name", ""),
                "position": position_map.get(p.get("element_type", 0), ""),
                "status": _FPL_STATUS_MAP.get(status, status),
                "news": news,
                "chance_of_playing": p.get("chance_of_playing_next_round"),
                "photo": f"https://resources.premierleague.com/premierleague/photos/players/110x140/p{p.get('photo','').replace('.jpg','')}.png",
            })

        return results

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None


fpl = FPLSource()


# ── API-Football source ────────────────────────────────────────────────────────

_APIF_BASE = "https://v3.football.api-sports.io"

# ESPN league slug → (API-Football league id, season year)
# Free plan supports up to season 2024 (2024-25)
_APIF_LEAGUE_MAP: dict[str, tuple[int, int]] = {
    "ENG.1":  (39,  2024),
    "ENG.2":  (40,  2024),
    "ESP.1":  (140, 2024),
    "GER.1":  (78,  2024),
    "ITA.1":  (135, 2024),
    "FRA.1":  (61,  2024),
    "NED.1":  (88,  2024),
    "POR.1":  (94,  2024),
    "SCO.1":  (179, 2024),
    "UEFA.CL": (2,  2024),
    "UEFA.EL": (3,  2024),
}


def _name_in_squad(api_name: str, squad: set[str]) -> bool:
    """
    Fuzzy match an API-Football name (e.g. 'K. De Bruyne') against a set of
    ESPN roster names (e.g. {'kevin de bruyne', 'k. de bruyne', 'de bruyne'}).
    Tries: exact lowercase, last-name-only, partial containment.
    """
    lower = api_name.lower().strip()
    if lower in squad:
        return True
    # Last name match (e.g. 'de bruyne' from 'K. De Bruyne')
    parts = lower.split()
    if len(parts) > 1 and parts[-1] in squad:
        return True
    # Partial: any squad name contains this last name
    last = parts[-1] if parts else lower
    return any(last in sq_name for sq_name in squad)


class APIFootballSource:
    """Thin async wrapper around api-football.com v3."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        # team name (lower) → API-Football team id
        self._team_id_cache: dict[str, int] = {}

    def _ensure_client(self, api_key: str) -> httpx.AsyncClient:
        headers = {"x-apisports-key": api_key}
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers=headers, timeout=httpx.Timeout(10.0)
            )
        return self._client

    async def _get(self, api_key: str, url: str, **params) -> dict:
        client = self._ensure_client(api_key)
        # Refresh auth header if key changed
        client.headers.update({"x-apisports-key": api_key})
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            logger.warning("API-Football request failed %s: %s", url, exc)
            return {}

    async def find_team_id(self, team_name: str, api_key: str) -> int | None:
        key = team_name.lower().strip()
        if key in self._team_id_cache:
            return self._team_id_cache[key]
        data = await self._get(api_key, f"{_APIF_BASE}/teams", name=team_name)
        for item in data.get("response", []):
            t = item.get("team", {})
            self._team_id_cache[t.get("name", "").lower()] = t["id"]
            self._team_id_cache[t.get("shortName", "").lower()] = t["id"]
        return self._team_id_cache.get(key)

    async def fetch_injuries(
        self, team_name: str, league_slug: str, api_key: str,
        current_squad: set[str] | None = None,
    ) -> list[dict]:
        """
        Return current-season injury list for a team.
        Each item: {name, position, type, reason, photo}.

        If current_squad (set of lowercase names) is provided, only players
        present in that set are included — filters out transferred players.
        """
        if not api_key:
            return []

        team_id = await self.find_team_id(team_name, api_key)
        if not team_id:
            logger.debug("API-Football: team not found for '%s'", team_name)
            return []

        league_info = _APIF_LEAGUE_MAP.get(league_slug)
        if not league_info:
            logger.debug("API-Football: no league mapping for slug %s", league_slug)
            return []
        league_id, season = league_info

        data = await self._get(
            api_key,
            f"{_APIF_BASE}/injuries",
            league=league_id,
            season=season,
            team=team_id,
        )
        records = data.get("response", [])

        # Deduplicate by player id — keep most recent fixture report
        latest: dict[int, dict] = {}
        for item in records:
            p = item.get("player", {})
            pid = p.get("id", 0)
            fdate = item.get("fixture", {}).get("date", "")
            if pid not in latest or fdate > latest[pid]["_date"]:
                latest[pid] = {
                    "_date": fdate,
                    "name": p.get("name", "Unknown"),
                    "position": p.get("position", ""),
                    "type": p.get("type", "Injured"),
                    "reason": p.get("reason") or p.get("type", ""),
                    "photo": p.get("photo", ""),
                }

        results = [
            {k: v for k, v in entry.items() if not k.startswith("_")}
            for entry in latest.values()
        ]

        # Filter to current squad only (removes transferred players)
        if current_squad:
            results = [
                r for r in results
                if _name_in_squad(r.get("name", ""), current_squad)
            ]

        return results

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None


api_football = APIFootballSource()
