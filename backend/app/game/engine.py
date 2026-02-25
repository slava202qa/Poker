"""
Texas Hold'em game engine.
Full cycle: preflop -> flop -> turn -> river -> showdown.
Supports side pots, all-in, rake, and turn timers.
"""
import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Awaitable

from app.game.deck import Deck, Card
from app.game.hand_evaluator import evaluate_hand, HandRank
from app.game.player_fsm import PlayerState, PlayerStatus
from app.game.pot import PotManager
from app.game.table_fsm import Street, next_street


class ActionType(str, Enum):
    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    BET = "bet"
    RAISE = "raise"
    ALL_IN = "all_in"


@dataclass
class GameAction:
    user_id: int
    action: ActionType
    amount: float = 0


@dataclass
class HandResult:
    winners: list[dict]  # [{user_id, amount, hand_rank, cards}]
    pots: list[dict]
    rake: float
    community_cards: list[dict]


class GameEngine:
    """Manages a single table's game state."""

    def __init__(
        self,
        table_id: int,
        small_blind: float,
        big_blind: float,
        rake_percent: float = 3.0,
        turn_timeout: float = 30.0,
        broadcast: Callable[..., Awaitable] | None = None,
    ):
        self.table_id = table_id
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.rake_percent = rake_percent
        self.turn_timeout = turn_timeout
        self.broadcast = broadcast  # async callback to push state to clients

        self.players: dict[int, PlayerState] = {}  # user_id -> PlayerState
        self.deck = Deck()
        self.pot_manager = PotManager()
        self.community_cards: list[Card] = []
        self.street: Street = Street.PREFLOP
        self.dealer_seat: int = 0
        self.current_player_id: int | None = None
        self.current_bet: float = 0
        self.min_raise: float = 0
        self.hand_in_progress: bool = False
        self._action_order: list[int] = []
        self._action_index: int = 0
        self._players_acted: set[int] = set()
        self._turn_deadline: float = 0

    # ── Player management ──

    def add_player(self, user_id: int, seat: int, stack: float):
        self.players[user_id] = PlayerState(user_id=user_id, seat=seat, stack=stack)

    def remove_player(self, user_id: int) -> float:
        """Remove player, return remaining stack."""
        player = self.players.pop(user_id, None)
        return player.stack if player else 0

    def seated_count(self) -> int:
        return len(self.players)

    # ── Hand lifecycle ──

    async def start_hand(self):
        """Start a new hand. Requires at least 2 players."""
        active = [p for p in self.players.values() if p.stack > 0]
        if len(active) < 2:
            return

        self.hand_in_progress = True
        self.community_cards = []
        self.pot_manager.reset()
        self.street = Street.PREFLOP
        self.current_bet = 0

        # Reset players
        for p in self.players.values():
            p.reset_for_new_hand()

        # Advance dealer
        self._advance_dealer()

        # Shuffle and deal
        self.deck.reset()
        for p in active:
            p.hole_cards = self.deck.deal(2)

        # Post blinds
        sb_player, bb_player = self._get_blind_players()
        sb_actual = sb_player.bet(self.small_blind)
        bb_actual = bb_player.bet(self.big_blind)
        self.pot_manager.add_bet(sb_player.user_id, sb_actual)
        self.pot_manager.add_bet(bb_player.user_id, bb_actual)
        self.current_bet = self.big_blind
        self.min_raise = self.big_blind

        # Set action order (UTG first preflop)
        self._build_action_order(after_bb=True)
        self._action_index = 0
        self._players_acted.clear()
        self._set_current_player()

        await self._broadcast_state()

    async def process_action(self, action: GameAction) -> dict:
        """Process a player action. Returns result dict."""
        if not self.hand_in_progress:
            return {"error": "No hand in progress"}

        if action.user_id != self.current_player_id:
            return {"error": "Not your turn"}

        player = self.players.get(action.user_id)
        if not player or not player.can_act:
            return {"error": "Cannot act"}

        result = self._apply_action(player, action)
        if "error" in result:
            return result

        self._players_acted.add(player.user_id)

        # Check if betting round is over
        if self._is_round_over():
            await self._end_betting_round()
        else:
            self._advance_to_next_player()
            await self._broadcast_state()

        return result

    def get_state(self, for_user_id: int | None = None) -> dict:
        """Get current game state. Cards hidden unless showdown or own cards."""
        is_showdown = self.street == Street.SHOWDOWN

        players_data = []
        for p in sorted(self.players.values(), key=lambda x: x.seat):
            reveal = is_showdown or (for_user_id and p.user_id == for_user_id)
            players_data.append(p.to_dict(reveal=reveal))

        return {
            "table_id": self.table_id,
            "street": self.street.value,
            "community_cards": [c.to_dict() for c in self.community_cards],
            "pot": self.pot_manager.total,
            "pots": self.pot_manager.get_pots_display(),
            "current_bet": self.current_bet,
            "current_player": self.current_player_id,
            "players": players_data,
            "hand_in_progress": self.hand_in_progress,
            "turn_timeout": self.turn_timeout,
            "turn_deadline": self._turn_deadline,
        }

    def get_valid_actions(self, user_id: int) -> list[dict]:
        """Return valid actions for a player."""
        if user_id != self.current_player_id:
            return []

        player = self.players.get(user_id)
        if not player or not player.can_act:
            return []

        actions = [{"action": ActionType.FOLD.value}]

        to_call = self.current_bet - player.current_bet
        if to_call <= 0:
            actions.append({"action": ActionType.CHECK.value})
        else:
            call_amount = min(to_call, player.stack)
            actions.append({"action": ActionType.CALL.value, "amount": call_amount})

        # Can raise if has more than call amount
        if player.stack > to_call:
            min_raise_to = self.current_bet + self.min_raise
            max_raise_to = player.current_bet + player.stack
            actions.append({
                "action": ActionType.RAISE.value,
                "min": min_raise_to,
                "max": max_raise_to,
            })

        # All-in is always available
        if player.stack > 0:
            actions.append({"action": ActionType.ALL_IN.value, "amount": player.stack})

        return actions

    # ── Internal methods ──

    def _apply_action(self, player: PlayerState, action: GameAction) -> dict:
        if action.action == ActionType.FOLD:
            player.fold()
            return {"action": "fold", "user_id": player.user_id}

        elif action.action == ActionType.CHECK:
            if self.current_bet > player.current_bet:
                return {"error": "Cannot check, must call or raise"}
            return {"action": "check", "user_id": player.user_id}

        elif action.action == ActionType.CALL:
            to_call = self.current_bet - player.current_bet
            actual = player.bet(to_call)
            self.pot_manager.add_bet(player.user_id, actual)
            return {"action": "call", "user_id": player.user_id, "amount": actual}

        elif action.action == ActionType.RAISE:
            raise_to = action.amount
            if raise_to < self.current_bet + self.min_raise:
                # Allow if it's an all-in
                if raise_to != player.current_bet + player.stack:
                    return {"error": f"Minimum raise to {self.current_bet + self.min_raise}"}

            raise_by = raise_to - self.current_bet
            if raise_by > self.min_raise:
                self.min_raise = raise_by

            to_put = raise_to - player.current_bet
            actual = player.bet(to_put)
            self.pot_manager.add_bet(player.user_id, actual)
            self.current_bet = player.current_bet

            # Reset acted players (everyone needs to act again)
            self._players_acted = {player.user_id}

            return {"action": "raise", "user_id": player.user_id, "amount": actual, "raise_to": self.current_bet}

        elif action.action == ActionType.ALL_IN:
            actual = player.bet(player.stack + player.current_bet)  # bet everything
            actual = player.stack  # already 0 after bet
            # Recalculate: bet the remaining stack
            player_state = self.players[player.user_id]
            # Player already went all-in via bet() method
            self.pot_manager.add_bet(player.user_id, action.amount)

            if player.current_bet > self.current_bet:
                self.current_bet = player.current_bet
                self._players_acted = {player.user_id}

            return {"action": "all_in", "user_id": player.user_id, "amount": action.amount}

        return {"error": "Invalid action"}

    def _is_round_over(self) -> bool:
        """Betting round ends when all active players have acted and bets are equal."""
        active = [p for p in self.players.values() if p.status == PlayerStatus.ACTIVE]

        # Only one player left (everyone else folded/all-in)
        if len(active) <= 1:
            return True

        # All active players have acted
        for p in active:
            if p.user_id not in self._players_acted:
                return False
            if p.current_bet != self.current_bet:
                return False

        return True

    async def _end_betting_round(self):
        """Collect bets and advance to next street or showdown."""
        active_ids = [
            p.user_id for p in self.players.values()
            if p.status in (PlayerStatus.ACTIVE, PlayerStatus.ALL_IN)
        ]
        self.pot_manager.collect_bets(active_ids)

        # Reset current bets for next round
        for p in self.players.values():
            p.reset_for_new_round()
        self.current_bet = 0
        self.min_raise = self.big_blind

        # Check if hand should end
        active_can_act = [p for p in self.players.values() if p.status == PlayerStatus.ACTIVE]
        not_folded = [
            p for p in self.players.values()
            if p.status in (PlayerStatus.ACTIVE, PlayerStatus.ALL_IN)
        ]

        if len(not_folded) <= 1:
            await self._end_hand()
            return

        if len(active_can_act) <= 1:
            # Run out remaining community cards
            await self._deal_remaining_streets()
            await self._showdown()
            return

        # Advance street
        next_s = next_street(self.street)
        if next_s == Street.SHOWDOWN:
            await self._showdown()
            return

        self.street = next_s
        self._deal_community_cards()
        self._build_action_order(after_bb=False)
        self._action_index = 0
        self._players_acted.clear()
        self._set_current_player()
        await self._broadcast_state()

    def _deal_community_cards(self):
        if self.street == Street.FLOP:
            self.deck.burn()
            self.community_cards.extend(self.deck.deal(3))
        elif self.street in (Street.TURN, Street.RIVER):
            self.deck.burn()
            self.community_cards.extend(self.deck.deal(1))

    async def _deal_remaining_streets(self):
        """Deal remaining community cards when all players are all-in."""
        while len(self.community_cards) < 5:
            self.deck.burn()
            if len(self.community_cards) == 0:
                self.community_cards.extend(self.deck.deal(3))
            else:
                self.community_cards.extend(self.deck.deal(1))

    async def _showdown(self):
        self.street = Street.SHOWDOWN
        not_folded = [
            p for p in self.players.values()
            if p.status in (PlayerStatus.ACTIVE, PlayerStatus.ALL_IN)
        ]

        # Evaluate hands
        hand_results: dict[int, tuple[HandRank, list[int]]] = {}
        for p in not_folded:
            all_cards = p.hole_cards + self.community_cards
            hand_results[p.user_id] = evaluate_hand(all_cards)

        # Distribute pots
        total_rake = 0
        winners = []

        for pot in self.pot_manager.pots:
            if pot.amount <= 0:
                continue

            eligible = [uid for uid in pot.eligible_players if uid in hand_results]
            if not eligible:
                continue

            # Find best hand among eligible
            best_hand = max(hand_results[uid] for uid in eligible)
            pot_winners = [uid for uid in eligible if hand_results[uid] == best_hand]

            # Rake
            rake = pot.amount * (self.rake_percent / 100)
            distributable = pot.amount - rake
            total_rake += rake

            share = distributable / len(pot_winners)
            for uid in pot_winners:
                self.players[uid].stack += share
                winners.append({
                    "user_id": uid,
                    "amount": share,
                    "hand_rank": hand_results[uid][0].name,
                    "cards": [c.to_dict() for c in self.players[uid].hole_cards],
                })

        self.hand_in_progress = False
        await self._broadcast_state()

    async def _end_hand(self):
        """End hand when only one player remains (everyone else folded)."""
        not_folded = [
            p for p in self.players.values()
            if p.status in (PlayerStatus.ACTIVE, PlayerStatus.ALL_IN)
        ]

        if len(not_folded) == 1:
            winner = not_folded[0]
            total = self.pot_manager.total
            rake = total * (self.rake_percent / 100)
            winnings = total - rake
            winner.stack += winnings

        self.hand_in_progress = False
        await self._broadcast_state()

    def _advance_dealer(self):
        seats = sorted(p.seat for p in self.players.values() if p.stack > 0)
        if not seats:
            return
        try:
            idx = seats.index(self.dealer_seat)
            self.dealer_seat = seats[(idx + 1) % len(seats)]
        except ValueError:
            self.dealer_seat = seats[0]

    def _get_blind_players(self) -> tuple[PlayerState, PlayerState]:
        """Get SB and BB players based on dealer position."""
        active = sorted(
            [p for p in self.players.values() if p.stack > 0],
            key=lambda p: p.seat,
        )
        seats = [p.seat for p in active]
        dealer_idx = 0
        for i, s in enumerate(seats):
            if s >= self.dealer_seat:
                dealer_idx = i
                break

        n = len(active)
        if n == 2:
            # Heads-up: dealer is SB
            sb_idx = dealer_idx
            bb_idx = (dealer_idx + 1) % n
        else:
            sb_idx = (dealer_idx + 1) % n
            bb_idx = (dealer_idx + 2) % n

        return active[sb_idx], active[bb_idx]

    def _build_action_order(self, after_bb: bool):
        """Build the order of action for current street."""
        active = sorted(
            [p for p in self.players.values() if p.status == PlayerStatus.ACTIVE],
            key=lambda p: p.seat,
        )
        seats = [p.seat for p in active]
        user_ids = [p.user_id for p in active]

        if not seats:
            self._action_order = []
            return

        if after_bb:
            # Preflop: start after BB
            _, bb = self._get_blind_players()
            try:
                bb_idx = seats.index(bb.seat)
                start = (bb_idx + 1) % len(seats)
            except ValueError:
                start = 0
        else:
            # Post-flop: start after dealer
            dealer_idx = 0
            for i, s in enumerate(seats):
                if s >= self.dealer_seat:
                    dealer_idx = i
                    break
            start = (dealer_idx + 1) % len(seats)

        order = []
        for i in range(len(seats)):
            idx = (start + i) % len(seats)
            order.append(user_ids[idx])

        self._action_order = order

    def _set_current_player(self):
        if self._action_index < len(self._action_order):
            self.current_player_id = self._action_order[self._action_index]
            self._turn_deadline = time.time() + self.turn_timeout
        else:
            self.current_player_id = None

    def _advance_to_next_player(self):
        """Move to next active player in action order."""
        for _ in range(len(self._action_order)):
            self._action_index = (self._action_index + 1) % len(self._action_order)
            uid = self._action_order[self._action_index]
            player = self.players.get(uid)
            if player and player.can_act:
                self.current_player_id = uid
                self._turn_deadline = time.time() + self.turn_timeout
                return

        self.current_player_id = None

    async def handle_timeout(self, user_id: int):
        """Auto-fold player who timed out."""
        if self.current_player_id == user_id:
            await self.process_action(GameAction(user_id=user_id, action=ActionType.FOLD))

    async def _broadcast_state(self):
        if self.broadcast:
            await self.broadcast(self.table_id, self.get_state())
