import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.tournament import Tournament, TournamentPlayer, TournamentStatus
from app.models.balance import Balance, Transaction, TxType

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


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


@router.get("/", response_model=list[TournamentResponse])
async def list_tournaments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tournament).order_by(Tournament.starts_at))
    tournaments = result.scalars().all()
    return [
        TournamentResponse(
            id=t.id, name=t.name, buy_in=float(t.buy_in), fee=float(t.fee),
            starting_stack=float(t.starting_stack), max_players=t.max_players,
            current_players=t.current_players, prize_pool=float(t.prize_pool),
            status=t.status.value, starts_at=t.starts_at.isoformat(),
        )
        for t in tournaments
    ]


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
    return TournamentResponse(
        id=t.id, name=t.name, buy_in=float(t.buy_in), fee=float(t.fee),
        starting_stack=float(t.starting_stack), max_players=t.max_players,
        current_players=t.current_players, prize_pool=float(t.prize_pool),
        status=t.status.value, starts_at=t.starts_at.isoformat(),
    )


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

    # Check already registered
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

    # Deduct buy-in + fee
    balance.amount = float(balance.amount) - total_cost

    # Buy-in goes to prize pool
    tournament.prize_pool = float(tournament.prize_pool) + float(tournament.buy_in)
    tournament.current_players += 1

    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.TOURNAMENT_ENTRY,
        amount=-total_cost,
        balance_after=float(balance.amount),
        reference=f"tournament:{tournament_id}",
    )
    db.add(tx)

    # Fee goes to system (rake) — tracked as separate tx
    fee_tx = Transaction(
        user_id=user.id,
        tx_type=TxType.RAKE,
        amount=-float(tournament.fee),
        balance_after=float(balance.amount),
        reference=f"tournament_fee:{tournament_id}",
    )
    db.add(fee_tx)

    tp = TournamentPlayer(tournament_id=tournament_id, user_id=user.id)
    db.add(tp)
    await db.flush()

    return {
        "status": "registered",
        "tournament_id": tournament_id,
        "cost": total_cost,
    }
