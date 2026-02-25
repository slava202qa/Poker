"""Texas Hold'em hand evaluator. Evaluates best 5-card hand from 7 cards."""
from itertools import combinations
from enum import IntEnum
from app.game.deck import Card, Rank


class HandRank(IntEnum):
    HIGH_CARD = 0
    ONE_PAIR = 1
    TWO_PAIR = 2
    THREE_OF_A_KIND = 3
    STRAIGHT = 4
    FLUSH = 5
    FULL_HOUSE = 6
    FOUR_OF_A_KIND = 7
    STRAIGHT_FLUSH = 8
    ROYAL_FLUSH = 9


def evaluate_hand(cards: list[Card]) -> tuple[HandRank, list[int]]:
    """
    Evaluate the best 5-card hand from a list of 5-7 cards.
    Returns (HandRank, kickers) where kickers is used for tie-breaking.
    Higher kicker values = better hand.
    """
    if len(cards) < 5:
        raise ValueError("Need at least 5 cards")

    best_rank = HandRank.HIGH_CARD
    best_kickers: list[int] = []

    for combo in combinations(cards, 5):
        hand_rank, kickers = _evaluate_five(list(combo))
        if (hand_rank, kickers) > (best_rank, best_kickers):
            best_rank = hand_rank
            best_kickers = kickers

    return best_rank, best_kickers


def _evaluate_five(cards: list[Card]) -> tuple[HandRank, list[int]]:
    """Evaluate exactly 5 cards."""
    ranks = sorted([c.rank.value for c in cards], reverse=True)
    suits = [c.suit for c in cards]

    is_flush = len(set(suits)) == 1
    is_straight, straight_high = _check_straight(ranks)

    # Count rank occurrences
    rank_counts: dict[int, int] = {}
    for r in ranks:
        rank_counts[r] = rank_counts.get(r, 0) + 1

    counts = sorted(rank_counts.values(), reverse=True)
    # Sort ranks by count then by rank value (for kicker ordering)
    sorted_by_count = sorted(rank_counts.keys(), key=lambda r: (rank_counts[r], r), reverse=True)

    if is_straight and is_flush:
        if straight_high == Rank.ACE.value:
            return HandRank.ROYAL_FLUSH, [straight_high]
        return HandRank.STRAIGHT_FLUSH, [straight_high]

    if counts == [4, 1]:
        return HandRank.FOUR_OF_A_KIND, sorted_by_count

    if counts == [3, 2]:
        return HandRank.FULL_HOUSE, sorted_by_count

    if is_flush:
        return HandRank.FLUSH, ranks

    if is_straight:
        return HandRank.STRAIGHT, [straight_high]

    if counts == [3, 1, 1]:
        return HandRank.THREE_OF_A_KIND, sorted_by_count

    if counts == [2, 2, 1]:
        return HandRank.TWO_PAIR, sorted_by_count

    if counts == [2, 1, 1, 1]:
        return HandRank.ONE_PAIR, sorted_by_count

    return HandRank.HIGH_CARD, ranks


def _check_straight(ranks: list[int]) -> tuple[bool, int]:
    """Check if sorted ranks form a straight. Handle A-2-3-4-5 (wheel)."""
    unique = sorted(set(ranks), reverse=True)
    if len(unique) != 5:
        return False, 0

    # Normal straight
    if unique[0] - unique[4] == 4:
        return True, unique[0]

    # Wheel: A-2-3-4-5
    if unique == [14, 5, 4, 3, 2]:
        return True, 5  # 5-high straight

    return False, 0


def compare_hands(
    hand_a: tuple[HandRank, list[int]],
    hand_b: tuple[HandRank, list[int]],
) -> int:
    """Compare two evaluated hands. Returns 1 if a wins, -1 if b wins, 0 if tie."""
    if hand_a > hand_b:
        return 1
    elif hand_a < hand_b:
        return -1
    return 0
