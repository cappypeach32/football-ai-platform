"""
ESPN Live Polling Service
Polls ESPN API every 30s, detects live matches, pushes updates via WebSocket,
and syncs live scores/status back to the database.
"""
import asyncio
import ssl
import structlog
from datetime import date
from typing import Any

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

# ESPN league slugs to poll
_LEAGUES = [
    "eng.1",           # Premier League
    "esp.1",           # La Liga
    "ger.1",           # Bundesliga
    "ita.1",           # Serie A
    "fra.1",           # Ligue 1
    "uefa.champions_league",
    "UEFA.EUROPA",     # UEFA Europa League
    "UEFA.EUROPA.CONF", # UEFA Conference League
]

_POLL_INTERVAL = 30  # seconds
_LIVE_STATES = {"in"}  # ESPN status.type.state values for in-progress

_LEAGUE_NAMES: dict[str, str] = {
    "eng.1": "Premier League",
    "esp.1": "La Liga",
    "ger.1": "Bundesliga",
    "ita.1": "Serie A",
    "fra.1": "Ligue 1",
    "uefa.champions_league": "UEFA Champions League",
    "UEFA.EUROPA": "UEFA Europa League",
    "UEFA.EUROPA.CONF": "UEFA Conference League",
}

# SSL context — macOS has cert issues with aiohttp
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FootballAI/1.0)"}


def _parse_event(event: dict[str, Any], league: str = "") -> dict[str, Any] | None:
    """Parse an ESPN event into our broadcast payload. Returns None if not interesting."""
    try:
        comp = event["competitions"][0]
        status = comp.get("status", {})
        stype = status.get("type", {})
        state = stype.get("state", "pre")
        completed = stype.get("completed", False)

        competitors = comp.get("competitors", [])
        home = next((c for c in competitors if c.get("homeAway") == "home"), {})
        away = next((c for c in competitors if c.get("homeAway") == "away"), {})

        return {
            "type": "match_update",
            "match_external_id": event.get("id"),
            "name": event.get("name", ""),
            "state": state,          # pre | in | post
            "completed": completed,
            "clock": status.get("displayClock", "0'"),
            "period": status.get("period"),
            "status_name": stype.get("name", ""),
            "home_team": home.get("team", {}).get("displayName", ""),
            "away_team": away.get("team", {}).get("displayName", ""),
            "home_score": int(home.get("score", 0) or 0),
            "away_score": int(away.get("score", 0) or 0),
            "home_logo": home.get("team", {}).get("logo", ""),
            "away_logo": away.get("team", {}).get("logo", ""),
            "venue": comp.get("venue", {}).get("fullName"),
            "league_slug": league,
            "league_name": _LEAGUE_NAMES.get(league, league),
        }
    except Exception as exc:
        logger.warning("espn_parse_error", error=str(exc))
        return None


async def _fetch_league(session: Any, league: str) -> tuple[str, list[dict[str, Any]]]:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard"
    try:
        async with session.get(url, ssl=_ssl_ctx, timeout=__import__("aiohttp").ClientTimeout(total=8)) as resp:
            if resp.status != 200:
                return league, []
            data = await resp.json(content_type=None)
            return league, data.get("events", [])
    except Exception as exc:
        logger.debug("espn_fetch_error", league=league, error=str(exc))
        return league, []


async def _sync_to_db(payload: dict[str, Any], state: str) -> None:
    """Sync live ESPN scores back to our Match rows in the database."""
    from app.database import AsyncSessionLocal
    from app.models.football import Match, Team
    from app.models.enums import MatchStatus

    home_slug = payload["home_team"].lower()[:8]
    away_slug = payload["away_team"].lower()[:8]

    try:
        async with AsyncSessionLocal() as db:
            home_alias = __import__("sqlalchemy.orm", fromlist=["aliased"]).aliased(Team, name="ht")
            away_alias = __import__("sqlalchemy.orm", fromlist=["aliased"]).aliased(Team, name="at")

            stmt = (
                select(Match)
                .join(home_alias, Match.home_team_id == home_alias.id)
                .join(away_alias, Match.away_team_id == away_alias.id)
                .where(
                    func.date(Match.match_date) == date.today(),
                    or_(
                        home_alias.name.ilike(f"%{payload['home_team'][:8]}%"),
                        home_alias.name.ilike(f"%{home_slug}%"),
                    ),
                    or_(
                        away_alias.name.ilike(f"%{payload['away_team'][:8]}%"),
                        away_alias.name.ilike(f"%{away_slug}%"),
                    ),
                )
                .limit(1)
            )
            result = await db.execute(stmt)
            match = result.scalar_one_or_none()
            if not match:
                return

            if state in _LIVE_STATES:
                match.status = MatchStatus.LIVE
                match.home_score = payload["home_score"]
                match.away_score = payload["away_score"]
                # Parse minute from clock string e.g. "45'+2'" → 47, "57'" → 57
                clock_str = payload.get("clock", "")
                try:
                    base = int(clock_str.split("+")[0].replace("'", "").strip())
                    extra = int(clock_str.split("+")[1].replace("'", "").strip()) if "+" in clock_str else 0
                    match.minute = base + extra
                except Exception:
                    pass

            elif state == "post":
                was_finished = match.status == MatchStatus.FINISHED
                match.status = MatchStatus.FINISHED
                match.home_score = payload["home_score"]
                match.away_score = payload["away_score"]
                match.minute = None

                # Settle predictions the first time this match reaches FINISHED
                if not was_finished:
                    await _settle_predictions(db, match)

            await db.commit()
            logger.debug("espn_db_synced", match_id=match.id, state=state,
                         score=f"{payload['home_score']}-{payload['away_score']}")
    except Exception as exc:
        logger.warning("espn_db_sync_error", error=str(exc))


async def _settle_predictions(db: Any, match: Any) -> None:
    """Evaluate all pending predictions for a finished match and write is_correct + profit_loss."""
    from app.models.football import Prediction
    from app.models.enums import PredictionResult

    UNIT_STAKE = 1.0

    home_score = match.home_score or 0
    away_score = match.away_score or 0
    total_goals = home_score + away_score

    stmt = select(Prediction).where(
        Prediction.match_id == match.id,
        Prediction.result == PredictionResult.PENDING,
    )
    result = await db.execute(stmt)
    preds = result.scalars().all()

    for pred in preds:
        bet = pred.recommended_bet
        if bet is None:
            continue

        # Determine if bet is correct
        if bet == "1":
            is_correct = home_score > away_score
        elif bet == "X":
            is_correct = home_score == away_score
        elif bet == "2":
            is_correct = away_score > home_score
        elif bet == "over_2.5":
            is_correct = total_goals > 2.5
        elif bet == "under_2.5":
            is_correct = total_goals < 2.5
        elif bet == "btts_yes":
            is_correct = home_score > 0 and away_score > 0
        elif bet == "btts_no":
            is_correct = home_score == 0 or away_score == 0
        else:
            continue

        # Resolve the odds for the recommended bet
        odds_map = {"1": pred.odds_home, "X": pred.odds_draw, "2": pred.odds_away}
        odds = odds_map.get(bet)

        pred.is_correct = is_correct
        pred.result = PredictionResult.WIN if is_correct else PredictionResult.LOSS
        if odds and odds > 1.0:
            pred.profit_loss = round((odds - 1) * UNIT_STAKE if is_correct else -UNIT_STAKE, 4)
        else:
            pred.profit_loss = round(UNIT_STAKE if is_correct else -UNIT_STAKE, 4)

    if preds:
        logger.info("predictions_settled", match_id=match.id, count=len(preds),
                    score=f"{home_score}-{away_score}")


async def espn_poll_loop(ws_manager: Any) -> None:
    """
    Background task: polls ESPN every 30s.
    For every event that changed since last poll → broadcasts to subscribed WebSocket clients.
    Also maintains ws_manager.live_state keyed by ESPN external_id.
    """
    import aiohttp

    prev_state: dict[str, dict] = {}  # external_id → last payload

    logger.info("espn_poll_loop_started", leagues=_LEAGUES, interval=_POLL_INTERVAL)

    while True:
        try:
            async with aiohttp.ClientSession(headers=_HEADERS) as session:
                tasks = [_fetch_league(session, lg) for lg in _LEAGUES]
                results = await asyncio.gather(*tasks, return_exceptions=True)

            live_count = 0
            for result in results:
                if isinstance(result, Exception):
                    continue
                league_slug, events = result
                if not events:
                    continue
                for event in events:
                    payload = _parse_event(event, league_slug)
                    if payload is None:
                        continue

                    ext_id = payload["match_external_id"]
                    state = payload["state"]

                    # Detect changes
                    prev = prev_state.get(ext_id)
                    changed = (
                        prev is None
                        or prev.get("home_score") != payload["home_score"]
                        or prev.get("away_score") != payload["away_score"]
                        or prev.get("state") != state
                        or prev.get("clock") != payload["clock"]
                    )

                    prev_state[ext_id] = payload

                    if state in _LIVE_STATES:
                        live_count += 1
                        ws_manager.live_state[ext_id] = payload

                        if changed:
                            # Sync scores to DB (fire-and-forget, don't block the loop)
                            asyncio.create_task(_sync_to_db(payload, state))

                            try:
                                numeric_id = int(ext_id)
                                await ws_manager.broadcast(numeric_id, payload)
                            except (ValueError, TypeError):
                                pass

                            await ws_manager.broadcast_all(payload)

                    elif state == "post" and ext_id in ws_manager.live_state:
                        # Match finished — sync final score to DB
                        asyncio.create_task(_sync_to_db(payload, state))
                        try:
                            numeric_id = int(ext_id)
                            await ws_manager.broadcast(numeric_id, {**payload, "type": "match_finished"})
                        except (ValueError, TypeError):
                            pass
                        del ws_manager.live_state[ext_id]

            if live_count:
                logger.info("espn_poll_ok", live_matches=live_count)

        except Exception as exc:
            logger.error("espn_poll_loop_error", error=str(exc))

        await asyncio.sleep(_POLL_INTERVAL)
