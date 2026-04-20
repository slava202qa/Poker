"""
NPC bot manager for Royal Roll.

Monitors tables and fills seats with bots when real player count < MIN_REAL_PLAYERS.
Bots play using pot-odds math only — they never see other players' hole cards.

Bot types:
  weak       — folds often, rarely bluffs
  balanced   — standard pot-odds play
  aggressive — raises frequently, bluffs occasionally
"""
import asyncio
import logging
import random
from dataclasses import dataclass, field
from typing import Literal

from app.game.engine import ActionType, GameAction
from app.game_manager import (
    get_engine,
    get_or_create_engine,
    player_joined,
    player_left,
    handle_ws_message,
)

logger = logging.getLogger(__name__)

BotStyle = Literal["weak", "balanced", "aggressive"]

# Tables where NPC bots are allowed (table_id -> min_real_players_to_activate)
NPC_TABLES: dict[int, int] = {}   # populated from DB on startup

MIN_REAL_PLAYERS = 1   # activate bots when at least 1 real player is seated
MAX_BOTS_PER_TABLE = 3
BOT_JOIN_DELAY_MIN = 5    # seconds — fast join for testing
BOT_JOIN_DELAY_MAX = 15
BOT_ACTION_DELAY_MIN = 1.5
BOT_ACTION_DELAY_MAX = 4.0
BOT_STACK = 5000.0
BOT_MAX_BET_RATIO = 0.4   # bot won't bet more than 40% of pot to avoid bullying

# NPC profiles — varied names and avatar seeds
NPC_PROFILES = [
    {"name": "Viktor_M",    "avatar": "npc_1", "style": "balanced"},
    {"name": "Alex_Pro",    "avatar": "npc_2", "style": "aggressive"},
    {"name": "SilentJohn",  "avatar": "npc_3", "style": "weak"},
    {"name": "DealerDave",  "avatar": "npc_4", "style": "balanced"},
    {"name": "LuckyLena",   "avatar": "npc_5", "style": "aggressive"},
    {"name": "OldTimer",    "avatar": "npc_6", "style": "weak"},
    {"name": "BluffKing",   "avatar": "npc_7", "style": "aggressive"},
    {"name": "SafePlayer",  "avatar": "npc_8", "style": "weak"},
    {"name": "MidStack",    "avatar": "npc_9", "style": "balanced"},
]

# NPC user IDs use negative range to never collide with real users
NPC_ID_BASE = -1000


@dataclass
class NpcBot:
    user_id: int
    table_id: int
    seat: int
    profile: dict
    style: BotStyle
    active: bool = True
    action_task: asyncio.Task | None = field(default=None, repr=False)


# Active bots: user_id -> NpcBot
_bots: dict[int, NpcBot] = {}
# Monitor tasks: table_id -> Task
_monitor_tasks: dict[int, asyncio.Task] = {}
_npc_id_counter = NPC_ID_BASE


def _next_npc_id() -> int:
    global _npc_id_counter
    _npc_id_counter -= 1
    return _npc_id_counter


def _real_player_count(table_id: int) -> int:
    engine = get_engine(table_id)
    if not engine:
        return 0
    return sum(1 for uid in engine.players if uid > 0)


def _bot_count(table_id: int) -> int:
    return sum(1 for b in _bots.values() if b.table_id == table_id and b.active)


def _free_seat(table_id: int) -> int | None:
    engine = get_engine(table_id)
    if not engine:
        return None
    occupied = {p.seat for p in engine.players.values()}
    for seat in range(1, 10):
        if seat not in occupied:
            return seat
    return None


def _pick_profile(table_id: int) -> dict:
    used_names = {b.profile["name"] for b in _bots.values() if b.table_id == table_id}
    available = [p for p in NPC_PROFILES if p["name"] not in used_names]
    return random.choice(available) if available else random.choice(NPC_PROFILES)


# ── Decision logic ──────────────────────────────────────────────────────────

def _decide_action(bot: NpcBot, state: dict) -> GameAction:
    """
    Pure math decision — bot sees only community cards and its own hole cards.
    Uses pot odds and hand strength estimate.
    """
    engine = get_engine(bot.table_id)
    if not engine:
        return GameAction(user_id=bot.user_id, action=ActionType.FOLD)

    player_state = engine.players.get(bot.user_id)
    if not player_state:
        return GameAction(user_id=bot.user_id, action=ActionType.FOLD)

    pot = state.get("pot", 0) or 1
    current_bet = state.get("current_bet", 0)
    my_bet = player_state.current_bet
    call_amount = max(0, current_bet - my_bet)
    stack = player_state.stack
    community = state.get("community_cards", [])
    hole_cards = player_state.hole_cards if hasattr(player_state, "hole_cards") else []

    # Estimate hand strength (0.0 – 1.0) from community cards count
    # Without seeing opponent cards — pure statistical estimate
    strength = _estimate_strength(hole_cards, community)

    style = bot.style
    rng = random.random()

    # Pot odds: if call_amount / (pot + call_amount) < strength → profitable call
    pot_odds = call_amount / (pot + call_amount) if (pot + call_amount) > 0 else 0

    # Style modifiers
    fold_bias   = {"weak": 0.35, "balanced": 0.15, "aggressive": 0.05}[style]
    raise_bias  = {"weak": 0.05, "balanced": 0.20, "aggressive": 0.45}[style]
    bluff_chance = {"weak": 0.03, "balanced": 0.08, "aggressive": 0.18}[style]

    # No bet to call — check or bet
    if call_amount == 0:
        if strength > 0.6 or rng < raise_bias:
            bet_size = min(
                round(pot * random.uniform(0.4, 0.8), 0),
                stack * BOT_MAX_BET_RATIO,
            )
            if bet_size >= engine.big_blind:
                return GameAction(user_id=bot.user_id, action=ActionType.BET, amount=bet_size)
        return GameAction(user_id=bot.user_id, action=ActionType.CHECK)

    # There is a bet to call
    if rng < fold_bias and strength < 0.4:
        return GameAction(user_id=bot.user_id, action=ActionType.FOLD)

    if strength > pot_odds or rng < bluff_chance:
        # Raise if strong or bluffing
        if strength > 0.75 and rng < raise_bias:
            raise_to = min(
                round(current_bet * random.uniform(2.0, 3.0), 0),
                stack * BOT_MAX_BET_RATIO + my_bet,
            )
            if raise_to > current_bet:
                return GameAction(user_id=bot.user_id, action=ActionType.RAISE, amount=raise_to)
        # Call
        if call_amount <= stack:
            return GameAction(user_id=bot.user_id, action=ActionType.CALL)

    return GameAction(user_id=bot.user_id, action=ActionType.FOLD)


def _estimate_strength(hole_cards: list, community: list) -> float:
    """
    Rough hand strength estimate based on card count visible.
    Does NOT use opponent cards — pure statistical baseline.
    """
    if not hole_cards:
        return 0.3  # unknown — assume average

    # Count high cards (A, K, Q, J = ranks 14,13,12,11)
    high_count = sum(1 for c in hole_cards if _rank_value(c) >= 11)
    pair = len(hole_cards) == 2 and _rank_value(hole_cards[0]) == _rank_value(hole_cards[1])

    base = 0.3 + high_count * 0.1 + (0.2 if pair else 0)

    # Community cards improve estimate variance
    if len(community) >= 3:
        base += random.uniform(-0.05, 0.15)

    return min(max(base, 0.05), 0.95)


def _rank_value(card) -> int:
    if isinstance(card, dict):
        r = card.get("rank", "2")
    else:
        r = getattr(card, "rank", "2")
    ranks = {"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
             "8": 8, "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14}
    return ranks.get(str(r), 2)


# ── Bot lifecycle ────────────────────────────────────────────────────────────

async def _bot_action_loop(bot: NpcBot):
    """Waits for bot's turn and acts."""
    while bot.active:
        await asyncio.sleep(1.0)
        engine = get_engine(bot.table_id)
        if not engine or not engine.hand_in_progress:
            continue
        if engine.current_player_id != bot.user_id:
            continue

        # Human-like delay
        delay = random.uniform(BOT_ACTION_DELAY_MIN, BOT_ACTION_DELAY_MAX)
        await asyncio.sleep(delay)

        # Re-check after delay
        engine = get_engine(bot.table_id)
        if not engine or engine.current_player_id != bot.user_id:
            continue

        state = engine.get_state(for_user_id=bot.user_id)
        action = _decide_action(bot, state)

        try:
            await handle_ws_message(bot.table_id, bot.user_id, {
                "type": "action",
                "action": action.action.value,
                "amount": action.amount,
            })
        except Exception as e:
            logger.warning(f"NPC {bot.user_id} action error: {e}")


async def _add_bot(table_id: int, small_blind: float, big_blind: float):
    seat = _free_seat(table_id)
    if seat is None:
        return

    profile = _pick_profile(table_id)
    npc_id = _next_npc_id()
    style: BotStyle = profile["style"]

    bot = NpcBot(
        user_id=npc_id,
        table_id=table_id,
        seat=seat,
        profile=profile,
        style=style,
    )
    _bots[npc_id] = bot

    engine = get_or_create_engine(table_id, small_blind, big_blind)
    await player_joined(table_id, npc_id, seat, BOT_STACK, is_npc=True)

    bot.action_task = asyncio.create_task(_bot_action_loop(bot))
    logger.info(f"NPC {profile['name']} ({style}) joined table {table_id} seat {seat}")


async def _remove_bot(bot: NpcBot):
    bot.active = False
    if bot.action_task:
        bot.action_task.cancel()
    try:
        await player_left(bot.table_id, bot.user_id)
    except Exception:
        pass
    _bots.pop(bot.user_id, None)
    logger.info(f"NPC {bot.profile['name']} left table {bot.table_id}")


async def _monitor_table(table_id: int, small_blind: float, big_blind: float):
    """Continuously monitors a table and manages bot presence."""
    while True:
        await asyncio.sleep(10)
        try:
            real = _real_player_count(table_id)
            bots = _bot_count(table_id)

            if real >= MIN_REAL_PLAYERS and bots < MAX_BOTS_PER_TABLE:
                needed = min(MAX_BOTS_PER_TABLE - bots, MAX_BOTS_PER_TABLE)
                for _ in range(needed):
                    delay = random.uniform(BOT_JOIN_DELAY_MIN, BOT_JOIN_DELAY_MAX)
                    await asyncio.sleep(delay)
                    # Re-check after delay
                    if _real_player_count(table_id) >= MIN_REAL_PLAYERS:
                        if _bot_count(table_id) < MAX_BOTS_PER_TABLE:
                            await _add_bot(table_id, small_blind, big_blind)

            elif real == 0:
                # Remove all bots if no real players
                table_bots = [b for b in list(_bots.values()) if b.table_id == table_id]
                for bot in table_bots:
                    await _remove_bot(bot)

        except Exception as e:
            logger.error(f"NPC monitor error table {table_id}: {e}")


def start_npc_monitor(table_id: int, small_blind: float, big_blind: float):
    """Start monitoring a table for NPC management. Call from game_manager on table load."""
    if table_id in _monitor_tasks:
        return
    task = asyncio.create_task(_monitor_table(table_id, small_blind, big_blind))
    _monitor_tasks[table_id] = task
    logger.info(f"NPC monitor started for table {table_id}")


def stop_npc_monitor(table_id: int):
    task = _monitor_tasks.pop(table_id, None)
    if task:
        task.cancel()


def is_npc(user_id: int) -> bool:
    return user_id < 0


def get_npc_profile(user_id: int) -> dict | None:
    bot = _bots.get(user_id)
    return bot.profile if bot else None
