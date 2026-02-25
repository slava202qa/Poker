"""
Manages active game engines for all tables.
Bridges WebSocket events with the game engine.
"""
import logging
from app.game.engine import GameEngine, GameAction, ActionType
from app.ws import manager as ws_manager
from app.config import get_settings

logger = logging.getLogger(__name__)

# Active game engines: table_id -> GameEngine
_engines: dict[int, GameEngine] = {}


async def _broadcast(table_id: int, state: dict):
    await ws_manager.broadcast_to_table(table_id, state)


def get_engine(table_id: int) -> GameEngine | None:
    return _engines.get(table_id)


def create_engine(
    table_id: int,
    small_blind: float,
    big_blind: float,
) -> GameEngine:
    settings = get_settings()
    engine = GameEngine(
        table_id=table_id,
        small_blind=small_blind,
        big_blind=big_blind,
        rake_percent=settings.rake_percent,
        broadcast=_broadcast,
    )
    _engines[table_id] = engine
    return engine


def remove_engine(table_id: int):
    _engines.pop(table_id, None)


async def handle_ws_message(table_id: int, user_id: int, data: dict) -> dict:
    """Process incoming WebSocket message from a player."""
    engine = _engines.get(table_id)
    if not engine:
        return {"error": "No active game at this table"}

    msg_type = data.get("type")

    if msg_type == "action":
        action_str = data.get("action", "")
        amount = float(data.get("amount", 0))

        try:
            action_type = ActionType(action_str)
        except ValueError:
            return {"error": f"Invalid action: {action_str}"}

        result = await engine.process_action(
            GameAction(user_id=user_id, action=action_type, amount=amount)
        )
        return result

    elif msg_type == "get_state":
        return engine.get_state(for_user_id=user_id)

    elif msg_type == "get_actions":
        return {"actions": engine.get_valid_actions(user_id)}

    elif msg_type == "start_hand":
        await engine.start_hand()
        return {"status": "hand_started"}

    return {"error": f"Unknown message type: {msg_type}"}
