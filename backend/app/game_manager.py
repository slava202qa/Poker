"""
Manages active game engines for all tables.
Bridges WebSocket events, REST API joins, and the game engine.
Auto-creates engines on first join, auto-starts hands when 2+ players sit.
"""
import asyncio
import logging
from sqlalchemy import select
from app.game.engine import GameEngine, GameAction, ActionType
from app.ws import manager as ws_manager
from app.config import get_settings
from app.database import async_session

logger = logging.getLogger(__name__)

# Active game engines: table_id -> GameEngine
_engines: dict[int, GameEngine] = {}

# Pending "next hand" tasks so we can cancel them on shutdown
_next_hand_tasks: dict[int, asyncio.Task] = {}

# Turn timer tasks: table_id -> Task
_turn_timer_tasks: dict[int, asyncio.Task] = {}

HAND_RESTART_DELAY = 5.0  # seconds between hands


async def _broadcast(table_id: int, state: dict):
    await ws_manager.broadcast_to_table(table_id, state)


def get_engine(table_id: int) -> GameEngine | None:
    return _engines.get(table_id)


def get_or_create_engine(
    table_id: int,
    small_blind: float,
    big_blind: float,
    rake_override: float | None = None,
) -> GameEngine:
    """Get existing engine or create a new one for the table."""
    if table_id in _engines:
        return _engines[table_id]

    settings = get_settings()
    rake = rake_override if rake_override is not None else settings.rake_percent
    engine = GameEngine(
        table_id=table_id,
        small_blind=small_blind,
        big_blind=big_blind,
        rake_percent=rake,
        broadcast=_broadcast,
        on_hand_end=_on_hand_end,
    )
    _engines[table_id] = engine
    logger.info(f"Engine created for table {table_id} ({small_blind}/{big_blind}, rake={rake}%)")
    return engine


async def _on_hand_end(table_id: int, rake_amount: float, winners: list[dict]):
    """Called by engine when a hand finishes. Syncs DB and schedules next hand."""
    engine = _engines.get(table_id)
    if engine:
        await _sync_stacks_to_db(table_id, engine)
    if rake_amount > 0:
        await _record_rake(table_id, rake_amount)
    _schedule_next_hand(table_id)


def remove_engine(table_id: int):
    _engines.pop(table_id, None)
    task = _next_hand_tasks.pop(table_id, None)
    if task:
        task.cancel()
    timer = _turn_timer_tasks.pop(table_id, None)
    if timer:
        timer.cancel()


async def player_joined(table_id: int, user_id: int, seat: int, stack: float,
                         small_blind: float, big_blind: float,
                         rake_override: float | None = None):
    """Called from tables API when a player joins. Wires them into the engine."""
    engine = get_or_create_engine(table_id, small_blind, big_blind,
                                   rake_override=rake_override)
    engine.add_player(user_id, seat, stack)
    logger.info(f"Player {user_id} joined table {table_id} seat {seat} stack {stack}")

    await _broadcast(table_id, engine.get_state())

    # Auto-start hand if 2+ players and no hand running
    if engine.seated_count() >= 2 and not engine.hand_in_progress:
        _schedule_next_hand(table_id, delay=3.0)


async def player_left(table_id: int, user_id: int) -> float:
    """Called from tables API when a player leaves. Returns remaining stack."""
    engine = _engines.get(table_id)
    if not engine:
        return 0

    remaining = engine.remove_player(user_id)
    logger.info(f"Player {user_id} left table {table_id}, stack returned: {remaining}")

    await _broadcast(table_id, engine.get_state())

    if engine.seated_count() == 0:
        remove_engine(table_id)

    return remaining


def _schedule_next_hand(table_id: int, delay: float = HAND_RESTART_DELAY):
    """Schedule the next hand after a delay."""
    old = _next_hand_tasks.pop(table_id, None)
    if old:
        old.cancel()

    async def _start():
        await asyncio.sleep(delay)
        engine = _engines.get(table_id)
        if engine and engine.seated_count() >= 2 and not engine.hand_in_progress:
            await engine.start_hand()
            _start_turn_timer(table_id)

    _next_hand_tasks[table_id] = asyncio.create_task(_start())


# ── Turn timer ──

def _start_turn_timer(table_id: int):
    """Start a timer for the current player's turn."""
    old = _turn_timer_tasks.pop(table_id, None)
    if old:
        old.cancel()

    engine = _engines.get(table_id)
    if not engine or not engine.hand_in_progress or not engine.current_player_id:
        return

    user_id = engine.current_player_id
    timeout = engine.turn_timeout

    async def _timer():
        await asyncio.sleep(timeout)
        eng = _engines.get(table_id)
        if eng and eng.current_player_id == user_id and eng.hand_in_progress:
            logger.info(f"Turn timeout: auto-fold user {user_id} at table {table_id}")
            await eng.handle_timeout(user_id)
            if eng.hand_in_progress and eng.current_player_id:
                _start_turn_timer(table_id)
            elif not eng.hand_in_progress:
                await _sync_stacks_to_db(table_id, eng)
                _schedule_next_hand(table_id)

    _turn_timer_tasks[table_id] = asyncio.create_task(_timer())


# ── WebSocket message handler ──

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

        if "error" not in result:
            if engine.hand_in_progress and engine.current_player_id:
                _start_turn_timer(table_id)
            elif not engine.hand_in_progress:
                await _sync_stacks_to_db(table_id, engine)
                _schedule_next_hand(table_id)

        return result

    elif msg_type == "get_state":
        return engine.get_state(for_user_id=user_id)

    elif msg_type == "get_actions":
        return {"actions": engine.get_valid_actions(user_id)}

    elif msg_type == "start_hand":
        if engine.seated_count() >= 2 and not engine.hand_in_progress:
            await engine.start_hand()
            _start_turn_timer(table_id)
            return {"status": "hand_started"}
        return {"error": "Cannot start hand (need 2+ players or hand already running)"}

    return {"error": f"Unknown message type: {msg_type}"}


# ── DB sync ──

async def _sync_stacks_to_db(table_id: int, engine: GameEngine):
    """Write engine player stacks back to DB after a hand ends.
    Removes busted players (stack=0) from both engine and DB."""
    from app.models.table import TablePlayer, PokerTable
    from app.models.balance import Balance, Transaction, TxType, CurrencyType

    busted_ids = []

    try:
        async with async_session() as session:
            # Determine table currency
            tbl_result = await session.execute(
                select(PokerTable).where(PokerTable.id == table_id)
            )
            tbl = tbl_result.scalar_one_or_none()
            is_fun = tbl and tbl.currency == CurrencyType.FUN

            for uid, player in engine.players.items():
                result = await session.execute(
                    select(TablePlayer).where(
                        TablePlayer.table_id == table_id,
                        TablePlayer.user_id == uid,
                    )
                )
                tp = result.scalar_one_or_none()
                if not tp:
                    continue

                if player.stack <= 0:
                    busted_ids.append(uid)
                    await session.delete(tp)
                else:
                    tp.stack = player.stack

            if busted_ids and tbl:
                tbl.current_players = max(0, tbl.current_players - len(busted_ids))

            await session.commit()
            logger.info(f"Synced stacks for table {table_id}, busted: {busted_ids}")
    except Exception as e:
        logger.error(f"Failed to sync stacks for table {table_id}: {e}")

    # Remove busted players from engine
    for uid in busted_ids:
        engine.remove_player(uid)


async def _record_rake(table_id: int, rake_amount: float):
    """Record rake as a system transaction."""
    from app.models.balance import Transaction, TxType

    if rake_amount <= 0:
        return

    try:
        async with async_session() as session:
            # user_id=0 represents the system/house account
            tx = Transaction(
                user_id=0,
                tx_type=TxType.RAKE,
                amount=rake_amount,
                balance_after=0,  # system account — tracked separately
                reference=f"table:{table_id}",
            )
            session.add(tx)
            await session.commit()
            logger.info(f"Rake recorded: {rake_amount:.4f} from table {table_id}")
    except Exception as e:
        logger.error(f"Failed to record rake for table {table_id}: {e}")
