"""Table-level FSM: manages the flow of a single hand of Texas Hold'em."""
from enum import Enum
from app.game.deck import Card


class Street(str, Enum):
    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"


STREET_ORDER = [Street.PREFLOP, Street.FLOP, Street.TURN, Street.RIVER, Street.SHOWDOWN]


def next_street(current: Street) -> Street | None:
    idx = STREET_ORDER.index(current)
    if idx + 1 < len(STREET_ORDER):
        return STREET_ORDER[idx + 1]
    return None
