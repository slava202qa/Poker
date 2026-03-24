"""Tournament API: registration, start, seating, elimination, prizes."""
import asyncio
import datetime
import logging
import math
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.api.deps import get_current_user
from app.models.user import User
from app.models.tournament import Tournament, TournamentPlayer, TournamentStatus
from app.models.balance import Balance, Transaction, TxType, CurrencyType
from app.models.shop import PlayerStats

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tournaments", tags=["tournaments"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class TournamentResponse(BaseModel):
    id: int
    name: str
    buy_in: float
    fee: float
    starting_stack: float
    max_players: int
    current_players: int
    prize_pool: float
    status: str
    starts_at: str

    class Config:
        from_attributes = True


class CreateTournamentRequest(BaseModel):
    name: str
    buy_in: float
    fee: float
    starting_stack: float
    max_players: int = 100
    starts_at: datetime.datetime


# ── Prize structure ───────────────────────────────────────────────────────────

def _prize_structure(n_players: int) -> list[float]:
    """Return prize percentages for each finishing position (1st, 2nd, …).

    Pays top ~15% of field, minimum 1 place.
    """
    if n_players <= 1:
        return [1.0]
    paid = max(1, math.ceil(n_players * 0.15))
    # Simple structure: 50% / 30% / 20% for top 3, then split remainder
    if paid == 1:
        return [1.0]
    if paid == 2:
        return [0.65, 0.35]
    if paid == 3:
        return [0.50, 0.30, 0.20]
    # 4+ paid spots: top 3 get fixed %, rest split remaining equally
    base = [0.40, 0.25, 0.15]
    remaining = 1.0 - sum(base)
    rest = [remaining / (paid - 3)] * (paid - 3)
    return base + rest


def chip_chop(player_stack: float, total_chips: float, prize_pool: float) -> float:
    """Chip Chop formula: (stack / total_chips) * prize_pool."""
    if total_chips <= 0:
        return 0.0
    return round((player_stack / total_chips) * prize_pool, 4)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[TournamentResponse])
async def list_tournaments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).order_by(Tournament.starts_at))
    return [_to_resp(t) for t in result.scalars().all()]


@router.post("/", response_model=TournamentResponse)
async def create_tournament(
    body: CreateTournamentRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = Tournament(
        name=body.name, buy_in=body.buy_in, fee=body.fee,
        starting_stack=body.starting_stack, max_players=body.max_players,
        starts_at=body.starts_at,
    )
    db.add(t)
    await db.flush()
    await db.refresh(t)
    await db.commit()
    return _to_resp(t)


@router.post("/{tournament_id}/register")
async def register_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.status != TournamentStatus.REGISTERING:
        raise HTTPException(status_code=400, detail="Registration closed")
    if tournament.current_players >= tournament.max_players:
        raise HTTPException(status_code=400, detail="Tournament full")

    existing = await db.execute(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already registered")

    total_cost = float(tournament.buy_in) + float(tournament.fee)
    balance = user.balance
    if not balance or float(balance.amount) < total_cost:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    balance.amount = float(balance.amount) - total_cost
    tournament.prize_pool = float(tournament.prize_pool) + float(tournament.buy_in)
    tournament.current_players += 1

    db.add(Transaction(
        user_id=user.id, currency=CurrencyType.CHIP,
        tx_type=TxType.TOURNAMENT_ENTRY, amount=-total_cost,
        balance_after=float(balance.amount), reference=f"tournament:{tournament_id}",
    ))

    tp = TournamentPlayer(
        tournament_id=tournament_id,
        user_id=user.id,
        tournament_stack=float(tournament.starting_stack),
    )
    db.add(tp)
    await db.commit()
    return {"status": "registered", "tournament_id": tournament_id, "cost": total_cost}


@router.post("/{tournament_id}/start")
async def start_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start a tournament: seat players, create virtual tables, launch engines."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Not found")
    if tournament.status != TournamentStatus.REGISTERING:
        raise HTTPException(status_code=400, detail="Already started or finished")
    if tournament.current_players < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")

    tournament.status = TournamentStatus.RUNNING

    # Load all registered players
    players_result = await db.execute(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.is_eliminated == False,
        )
    )
    players = players_result.scalars().all()

    # Seat players: 6 per table
    seats_per_table = 6
    table_assignments: list[tuple[int, int, int]] = []  # (user_id, table_idx, seat)
    for idx, tp in enumerate(players):
        table_idx = idx // seats_per_table
        seat = idx % seats_per_table
        tp.table_id = tournament_id * 1000 + table_idx  # virtual table id
        tp.seat = seat
        table_assignments.append((tp.user_id, tp.table_id, seat))

    await db.commit()

    # Launch game engines for each virtual table
    asyncio.create_task(_launch_tournament_tables(tournament_id, table_assignments, tournament))

    return {
        "status": "started",
        "players": len(players),
        "tables": math.ceil(len(players) / seats_per_table),
    }


@router.post("/{tournament_id}/eliminate/{user_id}")
async def eliminate_player(
    tournament_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Mark a player as eliminated. Called internally when stack hits 0."""
    result = await db.execute(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.user_id == user_id,
        )
    )
    tp = result.scalar_one_or_none()
    if not tp:
        raise HTTPException(status_code=404, detail="Player not in tournament")

    tp.is_eliminated = True

    # Count remaining players to assign finish position
    remaining_result = await db.execute(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
            TournamentPlayer.is_eliminated == False,
        )
    )
    remaining = remaining_result.scalars().all()
    tp.finish_position = len(remaining) + 1

    # Check if tournament is over
    if len(remaining) <= 1:
        await _finish_tournament(tournament_id, db)

    await db.commit()
    return {"status": "eliminated", "finish_position": tp.finish_position}


@router.post("/{tournament_id}/finish")
async def finish_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Manually finish a tournament and distribute prizes."""
    await _finish_tournament(tournament_id, db)
    await db.commit()
    return {"status": "finished"}


@router.get("/{tournament_id}/standings")
async def get_standings(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return current standings with chip chop values."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Not found")

    players_result = await db.execute(
        select(TournamentPlayer, User)
        .join(User, TournamentPlayer.user_id == User.id)
        .where(TournamentPlayer.tournament_id == tournament_id)
        .order_by(TournamentPlayer.tournament_stack.desc())
    )
    rows = players_result.all()

    total_chips = sum(float(tp.tournament_stack) for tp, _ in rows if not tp.is_eliminated)
    prize_pool = float(tournament.prize_pool)

    return [
        {
            "user_id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "stack": float(tp.tournament_stack),
            "is_eliminated": tp.is_eliminated,
            "finish_position": tp.finish_position,
            "prize_won": float(tp.prize_won),
            "chip_chop_value": chip_chop(float(tp.tournament_stack), total_chips, prize_pool)
            if not tp.is_eliminated else 0,
        }
        for tp, u in rows
    ]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _to_resp(t: Tournament) -> TournamentResponse:
    return TournamentResponse(
        id=t.id, name=t.name, buy_in=float(t.buy_in), fee=float(t.fee),
        starting_stack=float(t.starting_stack), max_players=t.max_players,
        current_players=t.current_players, prize_pool=float(t.prize_pool),
        status=t.status.value, starts_at=t.starts_at.isoformat(),
    )


async def _finish_tournament(tournament_id: int, db: AsyncSession):
    """Distribute prizes to top finishers and mark tournament finished."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if not tournament or tournament.status == TournamentStatus.FINISHED:
        return

    tournament.status = TournamentStatus.FINISHED

    players_result = await db.execute(
        select(TournamentPlayer).where(
            TournamentPlayer.tournament_id == tournament_id,
        ).order_by(TournamentPlayer.finish_position.asc().nulls_last())
    )
    players = players_result.scalars().all()

    prize_pool = float(tournament.prize_pool)
    structure = _prize_structure(len(players))

    for i, tp in enumerate(players):
        if i < len(structure):
            prize = round(prize_pool * structure[i], 4)
            tp.prize_won = prize
            tp.finish_position = tp.finish_position or (i + 1)

            # Credit prize to user balance
            bal_result = await db.execute(
                select(Balance).where(Balance.user_id == tp.user_id)
            )
            bal = bal_result.scalar_one_or_none()
            if bal:
                bal.amount = float(bal.amount) + prize
                db.add(Transaction(
                    user_id=tp.user_id, currency=CurrencyType.CHIP,
                    tx_type=TxType.TOURNAMENT_PRIZE, amount=prize,
                    balance_after=float(bal.amount),
                    reference=f"tournament_prize:{tournament_id}:pos{tp.finish_position}",
                ))

            # Update PlayerStats
            stats_result = await db.execute(
                select(PlayerStats).where(PlayerStats.user_id == tp.user_id)
            )
            stats = stats_result.scalar_one_or_none()
            if stats:
                stats.tournaments_played = (stats.tournaments_played or 0) + 1
                if tp.finish_position == 1:
                    stats.tournaments_won = (stats.tournaments_won or 0) + 1

    await db.flush()
    logger.info(f"Tournament {tournament_id} finished, prizes distributed")


async def _launch_tournament_tables(
    tournament_id: int,
    assignments: list[tuple[int, int, int]],
    tournament: Tournament,
):
    """Create game engines for each tournament table."""
    from app.game_manager import get_or_create_engine, player_joined

    tables: dict[int, list[tuple[int, int]]] = {}
    for user_id, table_id, seat in assignments:
        tables.setdefault(table_id, []).append((user_id, seat))

    for table_id, players in tables.items():
        for user_id, seat in players:
            await player_joined(
                table_id=table_id,
                user_id=user_id,
                seat=seat,
                stack=float(tournament.starting_stack),
                small_blind=float(tournament.buy_in) * 0.01,
                big_blind=float(tournament.buy_in) * 0.02,
                rake_override=0.0,  # no rake in tournaments
            )
        logger.info(f"Tournament {tournament_id}: table {table_id} launched with {len(players)} players")
