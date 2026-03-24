"""Profile API: real stats from PlayerStats table, leaderboard."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.balance import Transaction, TxType
from app.models.shop import PlayerStats

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileResponse(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str
    ton_wallet: str | None
    balance: float
    fun_balance: float
    hands_played: int
    hands_won: int
    win_rate: float
    best_hand: str | None
    total_chips_won: float
    biggest_pot_won: float
    tournaments_played: int
    tournaments_won: int
    all_ins_won: int
    xp: int
    level: int
    login_streak: int
    total_deposited: float
    total_withdrawn: float
    member_since: str


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str | None
    first_name: str
    hands_won: int
    total_chips_won: float
    level: int
    xp: int


@router.get("/me", response_model=ProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stats_result = await db.execute(
        select(PlayerStats).where(PlayerStats.user_id == user.id)
    )
    stats = stats_result.scalar_one_or_none()

    hands_played = stats.hands_played if stats else 0
    hands_won = stats.hands_won if stats else 0
    win_rate = round((hands_won / hands_played * 100), 1) if hands_played > 0 else 0.0

    dep_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user.id, Transaction.tx_type == TxType.DEPOSIT)
    )
    total_deposited = float(dep_result.scalar() or 0)

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
        fun_balance=float(user.balance.fun_amount) if user.balance else 0,
        hands_played=hands_played,
        hands_won=hands_won,
        win_rate=win_rate,
        best_hand=stats.best_hand if stats else None,
        total_chips_won=float(stats.total_chips_won) if stats else 0,
        biggest_pot_won=float(stats.biggest_pot_won) if stats else 0,
        tournaments_played=stats.tournaments_played if stats else 0,
        tournaments_won=stats.tournaments_won if stats else 0,
        all_ins_won=stats.all_ins_won if stats else 0,
        xp=stats.xp if stats else 0,
        level=stats.level if stats else 1,
        login_streak=stats.login_streak if stats else 0,
        total_deposited=total_deposited,
        total_withdrawn=total_withdrawn,
        member_since=user.created_at.isoformat(),
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Top players by total chips won."""
    result = await db.execute(
        select(PlayerStats, User)
        .join(User, PlayerStats.user_id == User.id)
        .order_by(desc(PlayerStats.total_chips_won))
        .limit(limit)
    )
    rows = result.all()
    out = []
    for rank, (stats, u) in enumerate(rows, start=1):
        out.append(LeaderboardEntry(
            rank=rank,
            user_id=u.id,
            username=u.username,
            first_name=u.first_name,
            hands_won=stats.hands_won,
            total_chips_won=float(stats.total_chips_won),
            level=stats.level,
            xp=stats.xp,
        ))
    return out
