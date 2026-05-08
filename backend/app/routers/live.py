from fastapi import APIRouter
from app.websockets.manager import ws_manager

router = APIRouter()


@router.get("/matches")
async def live_matches_status():
    """Returns current live match state from ESPN polling cache."""
    return {
        "live_matches": list(ws_manager.live_state.values()),
        "count": ws_manager.live_match_count,
        "connected_clients": ws_manager.connected_clients,
    }
