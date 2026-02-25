"""Standard 52-card deck with shuffle and deal."""
import random
from dataclasses import dataclass
from enum import IntEnum


class Suit(IntEnum):
    CLUBS = 0
    DIAMONDS = 1
    HEARTS = 2
    SPADES = 3


class Rank(IntEnum):
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10
    JACK = 11
    QUEEN = 12
    KING = 13
    ACE = 14


SUIT_SYMBOLS = {Suit.CLUBS: "♣", Suit.DIAMONDS: "♦", Suit.HEARTS: "♥", Suit.SPADES: "♠"}
RANK_SYMBOLS = {
    Rank.TWO: "2", Rank.THREE: "3", Rank.FOUR: "4", Rank.FIVE: "5",
    Rank.SIX: "6", Rank.SEVEN: "7", Rank.EIGHT: "8", Rank.NINE: "9",
    Rank.TEN: "T", Rank.JACK: "J", Rank.QUEEN: "Q", Rank.KING: "K", Rank.ACE: "A",
}


@dataclass(frozen=True)
class Card:
    rank: Rank
    suit: Suit

    def __str__(self) -> str:
        return f"{RANK_SYMBOLS[self.rank]}{SUIT_SYMBOLS[self.suit]}"

    def __repr__(self) -> str:
        return str(self)

    def to_dict(self) -> dict:
        return {"rank": self.rank.value, "suit": self.suit.value, "display": str(self)}


class Deck:
    def __init__(self):
        self._cards: list[Card] = []
        self.reset()

    def reset(self):
        self._cards = [Card(rank=r, suit=s) for s in Suit for r in Rank]
        random.shuffle(self._cards)

    def deal(self, count: int = 1) -> list[Card]:
        if count > len(self._cards):
            raise ValueError("Not enough cards in deck")
        dealt = self._cards[:count]
        self._cards = self._cards[count:]
        return dealt

    def deal_one(self) -> Card:
        return self.deal(1)[0]

    def burn(self):
        """Burn top card (discard without revealing)."""
        if self._cards:
            self._cards.pop(0)

    @property
    def remaining(self) -> int:
        return len(self._cards)
