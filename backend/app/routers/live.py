from fastapi import APIRouter
from app.websockets.manager import ws_manager
from app.data_engine.sources import espn

router = APIRouter()


@router.get("/matches")
async def live_matches_status():
    """Returns current live match state from ESPN polling cache."""
    return {
        "live_matches": list(ws_manager.live_state.values()),
        "count": ws_manager.live_match_count,
        "connected_clients": ws_manager.connected_clients,
    }


@router.get("/lineup/{league_slug}/{event_id}")
async def live_lineup(league_slug: str, event_id: str):
    """
    Fetch starting lineups for a live/upcoming match from ESPN event summary.
    Lineup data is available from ~45 min before kickoff.
    Returns { home: {...}, away: {...} } or nulls if not yet available.
    """
    data = await espn.fetch_event_summary(event_id, league_slug)
    if not data:
        return {"home": None, "away": None}

    rosters = data.get("rosters", [])
    if not rosters:
        return {"home": None, "away": None}

    result: dict = {}
    for roster in rosters:
        side = roster.get("homeAway", "home")
        team_name = (roster.get("team") or {}).get("displayName", "")
        formation_raw = roster.get("formation") or {}
        formation_str = formation_raw.get("name", "") if isinstance(formation_raw, dict) else ""

        players = []
        for p in roster.get("roster", []):
            athlete = p.get("athlete") or {}
            name = athlete.get("displayName") or p.get("displayName", "Unknown")
            pos_obj = p.get("position") or {}
            pos_abbr = pos_obj.get("abbreviation", "")
            pos_name = pos_obj.get("name", "")
            jersey = p.get("jersey", "")
            starter = bool(p.get("starter", False))

            # Headshot from athlete.headshot or athlete.links
            headshot: str | None = (athlete.get("headshot") or {}).get("href")
            if not headshot:
                for link in athlete.get("links", []):
                    if "headshot" in (link.get("rel") or []):
                        headshot = link.get("href")
                        break

            players.append({
                "name": name,
                "position": pos_abbr,
                "position_name": pos_name,
                "jersey": jersey,
                "starter": starter,
                "photo_url": headshot,
            })

        result[side] = {
            "team": team_name,
            "formation": formation_str,
            "starters": [p for p in players if p["starter"]],
            "bench": [p for p in players if not p["starter"]],
        }

    return result
