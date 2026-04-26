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
    """Broadcast personalised state to all players at the table."""
    engine = _engines.get(table_id)
    # Enrich player data with display names (NPC profiles + real user names)
    await _enrich_player_names(state)
    await ws_manager.broadcast_to_table(table_id, state, engine=engine)


async def _enrich_player_names(state: dict):
    """Add display_name, is_npc, avatar fields to each player in state."""
    from app.npc_manager import is_npc, get_npc_profile
    players = state.get("players", [])
    if not players:
        return
    # Collect real user IDs
    real_ids = [p["user_id"] for p in players if not is_npc(p["user_id"])]
    user_names: dict[int, tuple[str, str | None]] = {}
    if real_ids:
        async with async_session() as db:
            from sqlalchemy import select as _select
            from app.models.user import User
            res = await db.execute(_select(User).where(User.telegram_id.in_(real_ids)))
            for u in res.scalars():
                name = u.first_name or u.username or f"Player{u.telegram_id}"
                user_names[u.telegram_id] = (name, u.avatar_url)
    for p in players:
        uid = p["user_id"]
        if is_npc(uid):
            profile = get_npc_profile(uid) or {}
            p["display_name"] = profile.get("name", "Bot")
            p["avatar"] = profile.get("avatar", "npc_1")
            p["is_npc"] = True
        else:
            name, avatar = user_names.get(uid, (f"Player{uid}", None))
            p["display_name"] = name
            p["avatar"] = avatar
            p["is_npc"] = False


def get_engine(table_id: int) -> GameEngine | None:
    return _engines.get(table_id)


def get_or_create_engine(
    table_id: int,
    small_blind: float,
    big_blind: float,
    rake_override: float | None = None,
    poker_type: str = "HOLDEM",
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
        poker_type=poker_type,
        broadcast=_broadcast,
        on_hand_end=_on_hand_end,
    )
    _engines[table_id] = engine
    logger.info(f"Engine created for table {table_id} ({small_blind}/{big_blind}, rake={rake}%, type={poker_type})")
    # Start NPC monitor for this table
    from app.npc_manager import start_npc_monitor
    start_npc_monitor(table_id, small_blind, big_blind)
    return engine


async def _on_hand_end(table_id: int, rake_amount: float, winners: list[dict]):
    """Called by engine when a hand finishes. Syncs DB and schedules next hand."""
    engine = _engines.get(table_id)
    if engine:
        await _sync_stacks_to_db(table_id, engine)
    if rake_amount > 0:
        await _record_rake(table_id, rake_amount)
    await _update_player_stats(table_id, winners)
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
                         small_blind: float = 1.0, big_blind: float = 2.0,
                         rake_override: float | None = None, is_npc: bool = False,
                         poker_type: str = "HOLDEM"):
    """Called from tables API when a player joins. Wires them into the engine."""
    engine = get_or_create_engine(table_id, small_blind, big_blind,
                                   rake_override=rake_override, poker_type=poker_type)
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
                # Skip NPC bots — they have no DB records
                from app.npc_manager import is_npc
                if is_npc(uid):
                    continue
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
    """Record rake as a system transaction and distribute syndicate shares."""
    from app.models.balance import Transaction, TxType
    from app.models.table import TablePlayer
    from app.api.referral import distribute_rake_syndicate

    if rake_amount <= 0:
        return

    try:
        async with async_session() as session:
            # user_id=0 represents the system/house account
            from app.models.balance import CurrencyType as _CT
            tx = Transaction(
                user_id=0,
                currency=_CT.CHIP,
                tx_type=TxType.RAKE,
                amount=rake_amount,
                balance_after=0,
                reference=f"table:{table_id}",
            )
            session.add(tx)

            # Distribute syndicate rake shares to referrers of all players at table
            engine = _engines.get(table_id)
            if engine:
                from app.npc_manager import is_npc
                real_players = [uid for uid in engine.players if not is_npc(uid)]
                if real_players:
                    # Split rake evenly among real players for syndicate distribution
                    per_player_rake = rake_amount / len(real_players)
                    for uid in real_players:
                        await distribute_rake_syndicate(uid, per_player_rake, session)

            await session.commit()
            logger.info(f"Rake recorded: {rake_amount:.4f} from table {table_id}")
    except Exception as e:
        logger.error(f"Failed to record rake for table {table_id}: {e}")


async def _update_player_stats(table_id: int, winners: list[dict]):
    """Update PlayerStats for all participants after a hand ends.

    winners: list of {user_id, amount, hand_rank, no_showdown}
    All seated players get hands_played++; winners get hands_won++ etc.
    Achievement conditions are re-evaluated after the update.
    """
    from sqlalchemy import select
    from app.models.shop import PlayerStats
    from app.api.achievements import check_and_award

    engine = _engines.get(table_id)
    if not engine:
        return

    from app.npc_manager import is_npc
    winner_ids = {w["user_id"] for w in winners if not is_npc(w["user_id"])}
    winner_map = {w["user_id"]: w for w in winners if not is_npc(w["user_id"])}

    try:
        async with async_session() as session:
            for uid in list(engine.players.keys()):
                result = await session.execute(
                    select(PlayerStats).where(PlayerStats.user_id == uid)
                )
                stats = result.scalar_one_or_none()
                if stats is None:
                    stats = PlayerStats(user_id=uid)
                    session.add(stats)
                    await session.flush()

                stats.hands_played = (stats.hands_played or 0) + 1

                if uid in winner_ids:
                    w = winner_map[uid]
                    stats.hands_won = (stats.hands_won or 0) + 1
                    amount = float(w.get("amount", 0))
                    stats.total_chips_won = float(stats.total_chips_won or 0) + amount
                    if amount > float(stats.biggest_pot_won or 0):
                        stats.biggest_pot_won = amount

                    if w.get("no_showdown"):
                        stats.hands_won_no_showdown = (stats.hands_won_no_showdown or 0) + 1

                    hand_rank = w.get("hand_rank", "")
                    if hand_rank:
                        # Track best hand (simple rank ordering)
                        _HAND_ORDER = [
                            "High Card", "One Pair", "Two Pair", "Three of a Kind",
                            "Straight", "Flush", "Full House", "Four of a Kind",
                            "Straight Flush", "Royal Flush",
                        ]
                        current_best = stats.best_hand or ""
                        curr_idx = _HAND_ORDER.index(current_best) if current_best in _HAND_ORDER else -1
                        new_idx = _HAND_ORDER.index(hand_rank) if hand_rank in _HAND_ORDER else -1
                        if new_idx > curr_idx:
                            stats.best_hand = hand_rank

                # XP per hand played + win bonus
                _XP_HAND = 15
                _XP_WIN  = 25
                xp_gain = _XP_HAND + (_XP_WIN if uid in winner_ids else 0)
                stats.xp = (stats.xp or 0) + xp_gain
                from app.api.achievements import _calc_level
                stats.level = _calc_level(stats.xp)

                # Battle pass XP
                from app.api.battlepass import grant_xp as bp_grant_xp
                await bp_grant_xp(uid, xp_gain, session)

            await session.flush()

            # Check achievements for all participants
            for uid in list(engine.players.keys()):
                newly = await check_and_award(uid, session)
                if newly:
                    logger.info(f"User {uid} unlocked achievements: {newly}")

            await session.commit()
    except Exception as e:
        logger.error(f"Failed to update player stats for table {table_id}: {e}")
