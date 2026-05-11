"""
Match Data Pipeline
===================
Orchestrates the full data flow:

    ESPN API  →  Validation  →  Normalization  →  DB Storage
                                                       ↓
                                                  Cache warm-up

This module is the single entry point for all data ingestion.
Replaces fetch_matches.py with a structured, testable pipeline.

Public API:
    ingest_date(target_date)        — import all matches for a date
    refresh_live_matches()          — update scores/status for LIVE matches
    get_team_form(team_id, league)  — cached recent results
    get_team_injuries(team_id)      — cached injury list
    get_h2h(home_id, away_id, league) — cached H2H results

ESPN leagues covered:
    UEFA.CHAMPIONS, UEFA.EUROPA, ENG.1, ESP.1, GER.1,
    ITA.1, FRA.1, POR.1, ENG.2
    (UEFA.EL.CONF excluded — returns 400 from ESPN)
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data_engine.cache import (
    cache,
    TTL_INJURIES, TTL_TEAM_FORM, TTL_H2H,
)
from app.data_engine.normalization import (
    NormalizedLeague, NormalizedMatch, NormalizedTeam,
    normalize_event,
)
from app.data_engine.sources import espn, api_football, fpl
from app.data_engine.validation import validate_events
from app.database import AsyncSessionLocal
from app.models import League, Match, MatchStatus, Team
from app.schemas import InjuredPlayerInfo, TeamFormEntry, H2HResult

logger = logging.getLogger(__name__)

# ── League registry ───────────────────────────────────────────────────────────
LEAGUES: list[NormalizedLeague] = [
    NormalizedLeague("UEFA.CHAMPIONS", "UEFA Champions League", "Europe",  1),
    NormalizedLeague("UEFA.EUROPA",    "UEFA Europa League",    "Europe",  1),
    NormalizedLeague("ENG.1",          "Premier League",        "England", 1),
    NormalizedLeague("ESP.1",          "La Liga",               "Spain",   1),
    NormalizedLeague("GER.1",          "Bundesliga",            "Germany", 1),
    NormalizedLeague("ITA.1",          "Serie A",               "Italy",   1),
    NormalizedLeague("FRA.1",          "Ligue 1",               "France",  1),
    NormalizedLeague("POR.1",          "Primeira Liga",         "Portugal",1),
    NormalizedLeague("ENG.2",          "Championship",          "England", 2),
]
_LEAGUE_BY_SLUG: dict[str, NormalizedLeague] = {lg.slug: lg for lg in LEAGUES}


# ── Pipeline result ───────────────────────────────────────────────────────────

@dataclass
class PipelineResult:
    date: str
    new_matches: int = 0
    updated_matches: int = 0
    skipped_invalid: int = 0
    leagues_processed: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def total_processed(self) -> int:
        return self.new_matches + self.updated_matches

    def __str__(self) -> str:
        return (
            f"PipelineResult({self.date}): "
            f"{self.new_matches} new, {self.updated_matches} updated, "
            f"{self.skipped_invalid} skipped, "
            f"{len(self.errors)} errors"
        )


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _upsert_league(session: AsyncSession, norm: NormalizedLeague) -> League:
    result = await session.execute(select(League).where(League.external_id == norm.slug))
    league = result.scalar_one_or_none()
    if not league:
        league = League(
            external_id=norm.slug,
            name=norm.name,
            country=norm.country,
            tier=norm.tier,
            season=norm.season,
            is_active=True,
        )
        session.add(league)
        await session.flush()
        logger.info("+ League: %s", norm.name)
    return league


async def _upsert_team(session: AsyncSession, norm: NormalizedTeam, league: League) -> Team:
    result = await session.execute(select(Team).where(Team.external_id == norm.external_id))
    team = result.scalar_one_or_none()
    if not team:
        team = Team(
            external_id=norm.external_id,
            name=norm.name,
            short_name=norm.short_name,
            logo_url=norm.logo_url,
            country=league.country,
            league_id=league.id,
            elo_rating=1500.0,
            attack_strength=1.0,
            defense_weakness=1.0,
        )
        session.add(team)
        await session.flush()
        logger.info("  + Team: %s", norm.name)
    else:
        # Update logo/short_name if ESPN provides them and we don't have them
        if norm.logo_url and not team.logo_url:
            team.logo_url = norm.logo_url
        if norm.short_name and not team.short_name:
            team.short_name = norm.short_name
    return team


async def _upsert_match(
    session: AsyncSession,
    norm: NormalizedMatch,
    league: League,
    home_team: Team,
    away_team: Team,
) -> tuple[Match, bool]:
    result = await session.execute(select(Match).where(Match.external_id == norm.external_id))
    match = result.scalar_one_or_none()

    created = False
    if not match:
        match = Match(
            external_id=norm.external_id,
            league_id=league.id,
            home_team_id=home_team.id,
            away_team_id=away_team.id,
            match_date=norm.match_date,
            status=norm.status,
            home_score=norm.home_score,
            away_score=norm.away_score,
            minute=norm.minute,
            venue=norm.venue,
            referee=norm.referee,
        )
        session.add(match)
        created = True
    else:
        # Always update mutable fields
        match.status = norm.status
        match.home_score = norm.home_score
        match.away_score = norm.away_score
        match.minute = norm.minute
        # Update venue/referee if newly available
        if norm.venue and not match.venue:
            match.venue = norm.venue
        if norm.referee and not match.referee:
            match.referee = norm.referee

    return match, created


# ── Core pipeline ─────────────────────────────────────────────────────────────

async def ingest_date(target_date: date | None = None) -> PipelineResult:
    """
    Full pipeline for one date:
      1. Fetch scoreboards from all leagues in parallel
      2. Validate each event
      3. Normalize
      4. Upsert to DB

    Args:
        target_date: Date to import. Defaults to today.

    Returns:
        PipelineResult with counts and any errors.
    """
    if target_date is None:
        target_date = date.today()

    date_str = target_date.strftime("%Y%m%d")
    result = PipelineResult(date=target_date.isoformat())

    logger.info("Pipeline: ingesting matches for %s", target_date.isoformat())

    # Step 1: Fetch all leagues in parallel (with cache check)
    slugs = [lg.slug for lg in LEAGUES]
    raw_by_slug: dict[str, list[dict]] = {}

    cached_slugs: list[str] = []
    fetch_slugs: list[str] = []

    for slug in slugs:
        cached = await cache.get_scoreboard(slug, date_str)
        if cached is not None:
            raw_by_slug[slug] = cached
            cached_slugs.append(slug)
        else:
            fetch_slugs.append(slug)

    if cached_slugs:
        logger.debug("Scoreboard cache hit for: %s", cached_slugs)

    if fetch_slugs:
        fetched = await espn.fetch_scoreboard_multi(fetch_slugs, date_str)
        for slug, events in fetched.items():
            raw_by_slug[slug] = events
            # Determine if any event is live to set appropriate TTL
            has_live = any(
                e.get("status", {}).get("type", {}).get("name", "") in
                ("STATUS_IN_PROGRESS", "STATUS_HALFTIME", "STATUS_END_PERIOD")
                for e in events
            )
            await cache.set_scoreboard(slug, date_str, events, live=has_live)

    # Step 2+3+4: Validate, normalize, store per league
    async with AsyncSessionLocal() as session:
        for league_meta in LEAGUES:
            slug = league_meta.slug
            raw_events = raw_by_slug.get(slug, [])
            if not raw_events:
                continue

            # Validate
            vr = validate_events(raw_events, source_label=slug)
            result.skipped_invalid += len(vr.invalid)

            if not vr.valid:
                continue

            result.leagues_processed.append(slug)
            league_db = await _upsert_league(session, league_meta)

            for raw_event, validated in zip(raw_events, [None] * len(raw_events)):
                # Find the corresponding validated event by id
                pass

            # Process validated events
            raw_by_id = {e.get("id"): e for e in raw_events}
            for validated_event in vr.valid:
                raw = raw_by_id.get(validated_event.id, {})
                raw_competition = raw.get("competitions", [{}])[0]

                try:
                    norm = normalize_event(validated_event, league_meta, raw_competition)
                except Exception as exc:
                    msg = f"Normalization error for event {validated_event.id}: {exc}"
                    logger.error(msg)
                    result.errors.append(msg)
                    continue

                try:
                    home_team_db = await _upsert_team(session, norm.home_team, league_db)
                    away_team_db = await _upsert_team(session, norm.away_team, league_db)
                    _, created = await _upsert_match(
                        session, norm, league_db, home_team_db, away_team_db
                    )
                    if created:
                        result.new_matches += 1
                    else:
                        result.updated_matches += 1
                except Exception as exc:
                    msg = f"DB error for event {validated_event.id}: {exc}"
                    logger.error(msg)
                    result.errors.append(msg)

        await session.commit()

    logger.info("Pipeline done: %s", result)
    return result


async def refresh_live_matches() -> PipelineResult:
    """
    Update scores and status for all currently LIVE matches.
    Called by the live endpoint / background scheduler.
    """
    today = date.today()
    # Invalidate live scoreboards to force fresh fetch
    for league in LEAGUES:
        await cache.invalidate(f"scoreboard:{league.slug}:{today.strftime('%Y%m%d')}")

    return await ingest_date(today)


# ── Enrichment helpers (form / injuries / H2H) ───────────────────────────────

def _espn_id(external_id: str | None) -> str | None:
    """Extract numeric ESPN team id from "espn_12345" format."""
    if external_id and external_id.startswith("espn_"):
        return external_id.split("_", 1)[1]
    return None


def _parse_score(score_val) -> int:
    """ESPN score can be int, float, str, or a dict with 'value'/'displayValue'."""
    if isinstance(score_val, dict):
        raw = score_val.get("displayValue") or score_val.get("value", 0)
    else:
        raw = score_val
    try:
        return int(float(str(raw)))
    except (ValueError, TypeError):
        return 0


# In-process name→id cache (survives the process lifetime, no DB needed)
_name_id_cache: dict[str, str] = {}


async def _resolve_espn_id(team_name: str, league_slug: str) -> str | None:
    """
    Return numeric ESPN ID for a team.
    Tries external_id first (fast), then searches ESPN teams list by name.
    Result is cached in-process.
    """
    cache_key = f"{league_slug}:{team_name.lower()}"
    if cache_key in _name_id_cache:
        return _name_id_cache[cache_key]
    team_id = await espn.find_team_id_by_name(team_name, league_slug)
    if team_id:
        _name_id_cache[cache_key] = team_id
    return team_id


async def _get_espn_id(team_external_id: str | None, team_name: str, league_slug: str) -> str | None:
    """Try external_id first, fall back to name lookup."""
    team_id = _espn_id(team_external_id)
    if team_id:
        return team_id
    return await _resolve_espn_id(team_name, league_slug)


async def get_team_injuries(team_external_id: str, team_name: str = "", league_slug: str = "") -> list[InjuredPlayerInfo]:
    """
    Fetch (or return cached) injury/suspension list for a team.

    - ENG.1 (Premier League): uses FPL official API — current-season, accurate.
    - Other leagues: returns [] (no reliable free source available).
    """
    if not team_name:
        return []

    cache_key = f"injuries:{team_name.lower()}:{league_slug}"
    cached = await cache.get_injuries(cache_key)
    if cached is not None:
        return cached

    injuries: list[InjuredPlayerInfo] = []

    if league_slug == "ENG.1":
        raw = await fpl.fetch_injuries(team_name)
        injuries = [
            InjuredPlayerInfo(
                name=item.get("name") or item.get("web_name", "Unknown"),
                position=item.get("position"),
                status=item.get("status", "Injured"),
                detail=item.get("news"),
                photo_url=item.get("photo"),  # FPL CDN works fine from the browser (client-side img tag)
                chance_of_playing=item.get("chance_of_playing"),
            )
            for item in raw
        ]

    await cache.set_injuries(cache_key, injuries)
    return injuries


async def get_team_form(team_external_id: str, league_slug: str, team_name: str = "") -> list[TeamFormEntry]:
    """
    Fetch (or return cached) last 5 finished results for a team.
    Returns a list of TeamFormEntry schema objects.
    """
    team_id = await _get_espn_id(team_external_id, team_name, league_slug)
    if not team_id:
        return []

    cached = await cache.get_team_form(team_id, league_slug)
    if cached is not None:
        return cached

    raw_events = await espn.fetch_team_schedule(team_id, league_slug)
    form: list[TeamFormEntry] = []

    for event in raw_events:
        comp = event.get("competitions", [{}])[0]
        competitors = comp.get("competitors", [])
        if len(competitors) < 2:
            continue

        our = next((c for c in competitors if str(c.get("id")) == str(team_id)), None)
        opp = next((c for c in competitors if str(c.get("id")) != str(team_id)), None)
        if not our or not opp:
            continue

        status_name = comp.get("status", {}).get("type", {}).get("name", "")
        if status_name not in ("STATUS_FINAL", "STATUS_FULL_TIME"):
            continue

        home_away = "H" if our.get("homeAway") == "home" else "A"
        try:
            gf = _parse_score(our.get("score", 0))
            ga = _parse_score(opp.get("score", 0))
        except (ValueError, TypeError):
            continue

        result_str = "W" if gf > ga else ("D" if gf == ga else "L")
        form.append(TeamFormEntry(
            date=event.get("date", "")[:10],
            opponent=opp.get("team", {}).get("displayName", "?"),
            home_or_away=home_away,
            goals_for=gf,
            goals_against=ga,
            result=result_str,
            competition=event.get("name", ""),
        ))

    # Last 5 finished, chronological
    form = list(reversed(form))[-5:]

    await cache.set_team_form(team_id, league_slug, form)
    return form


async def get_h2h(
    home_external_id: str,
    away_external_id: str,
    league_slug: str,
    home_name: str = "",
    away_name: str = "",
) -> list[H2HResult]:
    """
    Fetch (or return cached) last 5 H2H results between two teams.
    Approximates H2H by scanning the home team's schedule for matches vs the away team.
    """
    home_id = await _get_espn_id(home_external_id, home_name, league_slug)
    away_id = await _get_espn_id(away_external_id, away_name, league_slug)
    if not home_id or not away_id:
        return []

    cached = await cache.get_h2h(home_id, away_id, league_slug)
    if cached is not None:
        return cached

    raw_events = await espn.fetch_team_schedule(home_id, league_slug)
    h2h: list[H2HResult] = []

    for event in raw_events:
        comp = event.get("competitions", [{}])[0]
        competitors = comp.get("competitors", [])
        ids = [str(c.get("id", "")) for c in competitors]
        if str(away_id) not in ids:
            continue

        status_name = comp.get("status", {}).get("type", {}).get("name", "")
        if status_name not in ("STATUS_FINAL", "STATUS_FULL_TIME"):
            continue

        home_c = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
        away_c = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])
        try:
            hs = _parse_score(home_c.get("score", 0))
            as_ = _parse_score(away_c.get("score", 0))
        except (ValueError, TypeError):
            continue

        h2h.append(H2HResult(
            date=event.get("date", "")[:10],
            home_team=home_c.get("team", {}).get("displayName", "?"),
            away_team=away_c.get("team", {}).get("displayName", "?"),
            home_score=hs,
            away_score=as_,
            competition=event.get("name", ""),
        ))

    h2h = list(reversed(h2h))[-5:]
    await cache.set_h2h(home_id, away_id, league_slug, h2h)
    return h2h


async def get_schedule_congestion(team_external_id: str, db: AsyncSession) -> float:
    """Returns days since team's last finished match. Returns 7.0 if no history."""
    from sqlalchemy import or_

    team_result = await db.execute(select(Team).where(Team.external_id == team_external_id))
    team = team_result.scalar_one_or_none()
    if not team:
        return 7.0

    q = (
        select(Match.match_date)
        .where(
            or_(Match.home_team_id == team.id, Match.away_team_id == team.id),
            Match.status == MatchStatus.FINISHED,
        )
        .order_by(Match.match_date.desc())
        .limit(1)
    )
    result = await db.execute(q)
    last_date = result.scalar_one_or_none()
    if not last_date:
        return 7.0

    now = datetime.now(timezone.utc)
    if last_date.tzinfo is None:
        last_date = last_date.replace(tzinfo=timezone.utc)
    return max(1.0, (now - last_date).total_seconds() / 86400)


# ── ESPN odds refresh ─────────────────────────────────────────────────────────

async def refresh_match_odds(match: Match, league_slug: str, db: AsyncSession) -> bool:
    """
    Fetch 1X2 odds from ESPN pickcenter and persist them on the match's Prediction.

    Returns True if odds were updated, False otherwise.
    Caches result for 30 minutes (odds don't change that often pre-match).
    """
    from app.models import Prediction

    if not match.external_id:
        return False

    cache_key = f"odds:espn:{match.external_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        odds = cached
    else:
        odds = await espn.fetch_match_odds(match.external_id, league_slug)
        if any(v is not None for v in odds.values()):
            await cache.set(cache_key, odds, ttl=1800)  # 30 min

    if not any(v is not None for v in odds.values()):
        return False

    result = await db.execute(
        select(Prediction).where(Prediction.match_id == match.id)
    )
    pred = result.scalar_one_or_none()
    if not pred:
        return False

    updated = False
    for field_name, key in (("odds_home", "home"), ("odds_draw", "draw"), ("odds_away", "away")):
        val = odds.get(key)
        if val is not None and getattr(pred, field_name) != val:
            setattr(pred, field_name, val)
            updated = True

    if updated:
        # Recompute value_bet with the fresh odds + stored probabilities
        _new_value = False
        for _prob, _odds in [
            (pred.home_win_prob, pred.odds_home),
            (pred.draw_prob,     pred.odds_draw),
            (pred.away_win_prob, pred.odds_away),
        ]:
            if _odds and _prob and _prob > (1.0 / _odds) * 1.03:
                _new_value = True
                break
        pred.value_bet = _new_value

        await db.commit()
        logger.info("odds_refreshed", match_id=match.id, odds=odds, value_bet=_new_value)

    return updated


# ── The Odds API bulk refresh ─────────────────────────────────────────────────

async def refresh_odds_for_upcoming(hours_ahead: int = 72) -> dict:
    """
    Refresh 1X2 odds for all upcoming predictions.

    Strategy:
      1. If ODDS_API_KEY is set → use The Odds API (best coverage, multi-book).
         One call per league → very quota-efficient.
      2. Otherwise → skip (ESPN pickcenter odds are fetched lazily per-match
         when the analysis endpoint is hit).

    Returns summary dict: {updated, skipped, errors, quota_remaining}
    """
    from app.models import Prediction
    from app.data_engine.sources import odds_api
    from app.config import settings
    from datetime import timedelta

    api_key = getattr(settings, "ODDS_API_KEY", "")
    if not api_key:
        logger.info("odds_refresh_skipped: ODDS_API_KEY not configured")
        return {"updated": 0, "skipped": 0, "errors": 0, "message": "ODDS_API_KEY not set"}

    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=hours_ahead)
    summary = {"updated": 0, "skipped": 0, "errors": 0, "quota_remaining": None}

    from sqlalchemy.orm import selectinload

    async with AsyncSessionLocal() as db:
        # Load all upcoming matches with predictions, grouped by league
        q = (
            select(Match)
            .join(Match.league)
            .options(
                selectinload(Match.home_team),
                selectinload(Match.away_team),
                selectinload(Match.league),
            )
            .where(
                Match.match_date >= now,
                Match.match_date <= cutoff,
                Match.status == MatchStatus.SCHEDULED,
            )
        )
        result = await db.execute(q)
        matches = result.scalars().all()

        if not matches:
            return {**summary, "message": "No upcoming matches found"}

        # Group by league slug for efficient API usage (1 call per league)
        from collections import defaultdict
        by_league: dict[str, list[Match]] = defaultdict(list)
        for m in matches:
            slug = m.league.external_id or ""
            if slug:
                by_league[slug].append(m)

        for league_slug, league_matches in by_league.items():
            try:
                # One API call for the whole league
                cache_key = f"odds_api:league:{league_slug}"
                events = await cache.get(cache_key)
                if events is None:
                    events = await odds_api.fetch_league_odds(league_slug, api_key)
                    if events:
                        await cache.set(cache_key, events, ttl=3600)  # 1 hr cache

                if not events:
                    summary["skipped"] += len(league_matches)
                    continue

                # Build lookup: (home_team_lower, away_team_lower) → odds
                odds_lookup: dict[tuple, dict] = {}
                for ev in events:
                    key = (
                        ev.get("home_team", "").lower().strip(),
                        ev.get("away_team", "").lower().strip(),
                    )
                    odds_lookup[key] = ev

                def _normalize(name: str) -> str:
                    """Normalize team name for fuzzy matching."""
                    return (
                        name.lower().strip()
                        .replace("&", "and")
                        .replace("afc ", "").replace(" afc", "")
                        .replace("fc ", "").replace(" fc", "")
                        .replace("  ", " ").strip()
                    )

                def _fuzzy_find(home_name: str, away_name: str) -> dict | None:
                    """Find matching event by exact then normalized then token-overlap."""
                    h = home_name.lower().strip()
                    a = away_name.lower().strip()
                    # 1. Exact
                    if (h, a) in odds_lookup:
                        return odds_lookup[(h, a)]
                    # 2. Normalized (handles & vs and, AFC prefix, FC suffix)
                    hn = _normalize(home_name)
                    an = _normalize(away_name)
                    for (ek_h, ek_a), ev in odds_lookup.items():
                        if _normalize(ev.get("home_team", "")) == hn and _normalize(ev.get("away_team", "")) == an:
                            return ev
                    # 3. Significant token overlap (handles "Brighton & Hove" vs "Brighton and Hove Albion")
                    h_tokens = set(hn.split()) - {"city", "united", "fc", "afc", "the"}
                    a_tokens = set(an.split()) - {"city", "united", "fc", "afc", "the"}
                    for (ek_h, ek_a), ev in odds_lookup.items():
                        ev_h_tokens = set(_normalize(ev.get("home_team", "")).split()) - {"city", "united", "fc", "afc", "the"}
                        ev_a_tokens = set(_normalize(ev.get("away_team", "")).split()) - {"city", "united", "fc", "afc", "the"}
                        if h_tokens and a_tokens and h_tokens <= ev_h_tokens and a_tokens <= ev_a_tokens:
                            return ev
                    return None

                for match in league_matches:
                    ev_odds = _fuzzy_find(match.home_team.name, match.away_team.name)

                    if not ev_odds or not ev_odds.get("home"):
                        summary["skipped"] += 1
                        continue

                    # Fetch prediction for this match
                    pred_result = await db.execute(
                        select(Prediction).where(Prediction.match_id == match.id)
                    )
                    pred = pred_result.scalar_one_or_none()
                    if not pred:
                        summary["skipped"] += 1
                        continue

                    updated = False
                    for field_name, key in (
                        ("odds_home", "home"),
                        ("odds_draw", "draw"),
                        ("odds_away", "away"),
                    ):
                        val = ev_odds.get(key)
                        if val is not None and getattr(pred, field_name) != val:
                            setattr(pred, field_name, val)
                            updated = True

                    if updated:
                        # Recompute value_bet with the fresh odds
                        _new_value = False
                        for _prob, _odds in [
                            (pred.home_win_prob, pred.odds_home),
                            (pred.draw_prob,     pred.odds_draw),
                            (pred.away_win_prob, pred.odds_away),
                        ]:
                            if _odds and _prob and _prob > (1.0 / _odds) * 1.03:
                                _new_value = True
                                break
                        pred.value_bet = _new_value
                        summary["updated"] += 1
                    else:
                        summary["skipped"] += 1

            except Exception as exc:
                logger.error("odds_refresh_error league=%s: %s", league_slug, exc)
                summary["errors"] += 1

        await db.commit()

    logger.info("odds_refresh_complete", **summary)
    return summary
