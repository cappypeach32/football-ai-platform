from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websockets.manager import ws_manager
import structlog

logger = structlog.get_logger()

router = APIRouter()


@router.websocket("/ws/live/{match_id}")
async def live_match_ws(match_id: int, websocket: WebSocket):
    """Subscribe to updates for a specific match (by ESPN external ID)."""
    await ws_manager.connect(match_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(match_id, websocket)


@router.websocket("/ws/global")
async def global_ws(websocket: WebSocket):
    """Subscribe to all live match updates + global alerts."""
    await ws_manager.connect_global(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_global(websocket)
