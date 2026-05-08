import asyncio
from typing import Any
from fastapi import WebSocket
import structlog

logger = structlog.get_logger()

_GLOBAL_CHANNEL = -1  # sentinel key for global subscribers


class WebSocketManager:
    def __init__(self):
        self._connections: dict[int, list[WebSocket]] = {}  # match_id -> [ws]
        self.live_state: dict[Any, dict[str, Any]] = {}     # ext_id -> latest state

    async def connect(self, match_id: int, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(match_id, []).append(websocket)
        logger.info("ws_connect", match_id=match_id, total=len(self._connections.get(match_id, [])))

        # Send current live state immediately on connect
        if match_id in self.live_state:
            await websocket.send_json(self.live_state[match_id])
        elif self.live_state:
            # Send all live matches for global channel
            await websocket.send_json({"type": "live_state", "matches": list(self.live_state.values())})

    async def connect_global(self, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(_GLOBAL_CHANNEL, []).append(websocket)
        # Send current live snapshot
        if self.live_state:
            await websocket.send_json({"type": "live_state", "matches": list(self.live_state.values())})

    def disconnect(self, match_id: int, websocket: WebSocket):
        conns = self._connections.get(match_id, [])
        if websocket in conns:
            conns.remove(websocket)
        logger.info("ws_disconnect", match_id=match_id, remaining=len(conns))

    def disconnect_global(self, websocket: WebSocket):
        self.disconnect(_GLOBAL_CHANNEL, websocket)

    async def broadcast(self, match_id: int, data: dict[str, Any]):
        self.live_state[data.get("match_external_id", match_id)] = data
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(match_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(match_id, ws)

    async def broadcast_all(self, data: dict[str, Any]):
        """Broadcast to global channel subscribers."""
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(_GLOBAL_CHANNEL, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(_GLOBAL_CHANNEL, ws)

    @property
    def connected_clients(self) -> int:
        return sum(len(v) for v in self._connections.values())

    @property
    def live_match_count(self) -> int:
        return len(self.live_state)


ws_manager = WebSocketManager()
