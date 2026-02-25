"""WebSocket manager for real-time game state updates."""
import json
import logging
from fastapi import WebSocket
from typing import Dict, Set

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per table."""

    def __init__(self):
        # table_id -> set of (user_id, websocket)
        self._connections: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, table_id: int, user_id: int, ws: WebSocket):
        await ws.accept()
        if table_id not in self._connections:
            self._connections[table_id] = {}
        self._connections[table_id][user_id] = ws
        logger.info(f"WS connected: user={user_id} table={table_id}")

    def disconnect(self, table_id: int, user_id: int):
        if table_id in self._connections:
            self._connections[table_id].pop(user_id, None)
            if not self._connections[table_id]:
                del self._connections[table_id]
        logger.info(f"WS disconnected: user={user_id} table={table_id}")

    async def broadcast_to_table(self, table_id: int, state: dict):
        """Send game state to all connected players at a table."""
        connections = self._connections.get(table_id, {})
        disconnected = []

        for user_id, ws in connections.items():
            try:
                # Send personalized state (each player sees own cards)
                personalized = dict(state)
                personalized["your_user_id"] = user_id
                await ws.send_json(personalized)
            except Exception:
                disconnected.append(user_id)

        for uid in disconnected:
            self.disconnect(table_id, uid)

    async def send_to_player(self, table_id: int, user_id: int, data: dict):
        connections = self._connections.get(table_id, {})
        ws = connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(table_id, user_id)


manager = ConnectionManager()
