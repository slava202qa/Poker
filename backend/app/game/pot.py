"""Pot management with side pot calculation for all-in scenarios."""
from dataclasses import dataclass, field


@dataclass
class Pot:
    amount: float = 0
    eligible_players: list[int] = field(default_factory=list)  # user_ids


class PotManager:
    def __init__(self):
        self.pots: list[Pot] = [Pot()]
        self._player_bets: dict[int, float] = {}  # user_id -> total bet this round

    @property
    def total(self) -> float:
        return sum(p.amount for p in self.pots)

    def add_bet(self, user_id: int, amount: float):
        """Track a bet from a player."""
        self._player_bets[user_id] = self._player_bets.get(user_id, 0) + amount

    def collect_bets(self, active_player_ids: list[int]):
        """
        Called at end of betting round. Distributes bets into main pot and side pots.
        Handles all-in players who bet less than others.
        """
        if not self._player_bets:
            return

        # Sort players by their bet amount
        sorted_bets = sorted(self._player_bets.items(), key=lambda x: x[1])

        remaining_bets = dict(self._player_bets)
        prev_level = 0

        new_pots: list[Pot] = []

        for user_id, bet_amount in sorted_bets:
            level = bet_amount
            if level <= prev_level:
                continue

            diff = level - prev_level
            pot = Pot()

            for pid, pbet in remaining_bets.items():
                contribution = min(pbet, diff)
                pot.amount += contribution
                remaining_bets[pid] = pbet - contribution

            # All players who bet at least this level are eligible
            pot.eligible_players = [
                pid for pid, orig_bet in self._player_bets.items()
                if orig_bet >= level and pid in active_player_ids
            ]

            if pot.amount > 0:
                new_pots.append(pot)

            prev_level = level

        # Merge into existing pots
        if new_pots:
            # Add to main pot first
            if self.pots and self.pots[-1].amount == 0:
                self.pots.pop()
            self.pots.extend(new_pots)

        self._player_bets.clear()

    def get_pots_display(self) -> list[dict]:
        return [
            {"amount": p.amount, "eligible": p.eligible_players}
            for p in self.pots if p.amount > 0
        ]

    def reset(self):
        self.pots = [Pot()]
        self._player_bets.clear()
