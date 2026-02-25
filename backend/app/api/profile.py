from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.balance import Transaction, TxType

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileResponse(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str
    ton_wallet: str | None
    balance: float
    total_games: int
    total_won: float
    total_deposited: float
    total_withdrawn: float
    member_since: str


@router.get("/me", response_model=ProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Count games (buy-ins)
    games_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.user_id == user.id, Transaction.tx_type == TxType.BUY_IN)
    )
    total_games = games_result.scalar() or 0

    # Total won (cash-outs + tournament prizes)
    won_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user.id,
            Transaction.tx_type.in_([TxType.CASH_OUT, TxType.TOURNAMENT_PRIZE]),
        )
    )
    total_won = float(won_result.scalar() or 0)

    # Total deposited
    dep_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user.id, Transaction.tx_type == TxType.DEPOSIT)
    )
    total_deposited = float(dep_result.scalar() or 0)

    # Total withdrawn
    wd_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user.id, Transaction.tx_type == TxType.WITHDRAW)
    )
    total_withdrawn = abs(float(wd_result.scalar() or 0))

    return ProfileResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        ton_wallet=user.ton_wallet,
        balance=float(user.balance.amount) if user.balance else 0,
        total_games=total_games,
        total_won=total_won,
        total_deposited=total_deposited,
        total_withdrawn=total_withdrawn,
        member_since=user.created_at.isoformat(),
    )
