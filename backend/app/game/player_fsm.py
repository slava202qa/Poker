"""Player state within a hand."""
from dataclasses import dataclass, field
from enum import Enum
from app.game.deck import Card


class PlayerStatus(str, Enum):
    ACTIVE = "active"
    FOLDED = "folded"
    ALL_IN = "all_in"
    SITTING_OUT = "sitting_out"


@dataclass
class PlayerState:
    user_id: int
    seat: int
    stack: float
    hole_cards: list[Card] = field(default_factory=list)
    status: PlayerStatus = PlayerStatus.ACTIVE
    current_bet: float = 0
    total_bet_this_hand: float = 0

    @property
    def is_active(self) -> bool:
        return self.status == PlayerStatus.ACTIVE

    @property
    def can_act(self) -> bool:
        return self.status in (PlayerStatus.ACTIVE,)

    def bet(self, amount: float) -> float:
        """Place a bet. Returns actual amount bet (may be less if all-in)."""
        actual = min(amount, self.stack)
        self.stack -= actual
        self.current_bet += actual
        self.total_bet_this_hand += actual
        if self.stack == 0:
            self.status = PlayerStatus.ALL_IN
        return actual

    def fold(self):
        self.status = PlayerStatus.FOLDED
        self.hole_cards = []

    def reset_for_new_round(self):
        """Reset bet tracking for new betting round (not new hand)."""
        self.current_bet = 0

    def reset_for_new_hand(self):
        self.hole_cards = []
        self.status = PlayerStatus.ACTIVE
        self.current_bet = 0
        self.total_bet_this_hand = 0

    def to_dict(self, reveal: bool = False) -> dict:
        return {
            "user_id": self.user_id,
            "seat": self.seat,
            "stack": self.stack,
            "status": self.status.value,
            "current_bet": self.current_bet,
            "cards": [c.to_dict() for c in self.hole_cards] if reveal else [],
        }
