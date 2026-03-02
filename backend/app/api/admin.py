"""
Admin API: table/tournament CRUD, user management, statistics.
Protected by Telegram ID whitelist (ADMIN_IDS in .env).
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.config import get_settings, Settings
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType
from app.models.table import PokerTable, TablePlayer, TableStatus
from app.models.tournament import Tournament, TournamentPlayer, TournamentStatus

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Admin auth dependency ──

async def require_admin(
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> User:
    if user.telegram_id not in settings.admin_id_list:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Schemas ──

class AdminStats(BaseModel):
    total_users: int
    active_today: int
    total_tables: int
    active_tables: int
    total_tournaments: int
    total_rake: float
    rake_today: float
    rake_week: float
    rake_month: float
    total_deposited: float
    total_withdrawn: float
    system_balance: float


class AdminUserResponse(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str
    ton_wallet: str | None
    balance: float
    is_banned: bool
    created_at: str
    last_seen: str


class CreateTableRequest(BaseModel):
    name: str
    max_players: int = 9
    small_blind: float
    big_blind: float
    min_buy_in: float
    max_buy_in: float


class UpdateTableRequest(BaseModel):
    name: str | None = None
    max_players: int | None = None
    small_blind: float | None = None
    big_blind: float | None = None
    min_buy_in: float | None = None
    max_buy_in: float | None = None
    status: str | None = None


class CreateTournamentRequest(BaseModel):
    name: str
    buy_in: float
    fee: float
    starting_stack: float
    max_players: int = 100
    starts_at: datetime.datetime


class UpdateTournamentRequest(BaseModel):
    name: str | None = None
    buy_in: float | None = None
    fee: float | None = None
    max_players: int | None = None
    status: str | None = None
    starts_at: datetime.datetime | None = None


class BanRequest(BaseModel):
    banned: bool


class AdjustBalanceRequest(BaseModel):
    amount: float
    reason: str = ""


# ── Check admin access ──

@router.get("/check")
async def check_admin(admin: User = Depends(require_admin)):
    return {"admin": True, "telegram_id": admin.telegram_id}


# ── Dashboard stats ──

@router.get("/stats", response_model=AdminStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - datetime.timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)

    # Users
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_today = (await db.execute(
        select(func.count(User.id)).where(User.last_seen >= today_start)
    )).scalar() or 0

    # Tables
    total_tables = (await db.execute(select(func.count(PokerTable.id)))).scalar() or 0
    active_tables = (await db.execute(
        select(func.count(PokerTable.id)).where(PokerTable.current_players > 0)
    )).scalar() or 0

    # Tournaments
    total_tournaments = (await db.execute(select(func.count(Tournament.id)))).scalar() or 0

    # Rake
    total_rake = abs(float((await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.tx_type == TxType.RAKE)
    )).scalar() or 0))

    rake_today = abs(float((await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.tx_type == TxType.RAKE, Transaction.created_at >= today_start)
    )).scalar() or 0))

    rake_week = abs(float((await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.tx_type == TxType.RAKE, Transaction.created_at >= week_start)
    )).scalar() or 0))

    rake_month = abs(float((await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.tx_type == TxType.RAKE, Transaction.created_at >= month_start)
    )).scalar() or 0))

    # Deposits / Withdrawals
    total_deposited = float((await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.tx_type == TxType.DEPOSIT)
    )).scalar() or 0)

    total_withdrawn = abs(float((await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.tx_type == TxType.WITHDRAW)
    )).scalar() or 0))

    # System balance (sum of all user balances)
    system_balance = float((await db.execute(
        select(func.coalesce(func.sum(Balance.amount), 0))
    )).scalar() or 0)

    return AdminStats(
        total_users=total_users,
        active_today=active_today,
        total_tables=total_tables,
        active_tables=active_tables,
        total_tournaments=total_tournaments,
        total_rake=total_rake,
        rake_today=rake_today,
        rake_week=rake_week,
        rake_month=rake_month,
        total_deposited=total_deposited,
        total_withdrawn=total_withdrawn,
        system_balance=system_balance,
    )


# ── Users ──

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    limit: int = 100,
    offset: int = 0,
    search: str = "",
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if search:
        query = query.where(
            User.username.ilike(f"%{search}%") | User.first_name.ilike(f"%{search}%")
        )
    result = await db.execute(query)
    users = result.scalars().all()

    out = []
    for u in users:
        bal_result = await db.execute(select(Balance).where(Balance.user_id == u.id))
        bal = bal_result.scalar_one_or_none()
        out.append(AdminUserResponse(
            id=u.id, telegram_id=u.telegram_id, username=u.username,
            first_name=u.first_name, ton_wallet=u.ton_wallet,
            balance=float(bal.amount) if bal else 0,
            is_banned=u.is_banned,
            created_at=u.created_at.isoformat(),
            last_seen=u.last_seen.isoformat(),
        ))
    return out


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    body: BanRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_banned = body.banned
    await db.flush()
    return {"status": "banned" if body.banned else "unbanned", "user_id": user_id}


@router.post("/users/{user_id}/adjust-balance")
async def adjust_balance(
    user_id: int,
    body: AdjustBalanceRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Balance).where(Balance.user_id == user_id))
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail="User balance not found")

    balance.amount = float(balance.amount) + body.amount
    tx = Transaction(
        user_id=user_id,
        tx_type=TxType.BONUS,
        amount=body.amount,
        balance_after=float(balance.amount),
        reference=f"admin_adjust:{body.reason}",
    )
    db.add(tx)
    await db.flush()
    return {"new_balance": float(balance.amount)}


@router.get("/users/{user_id}/transactions")
async def user_transactions(
    user_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    txs = result.scalars().all()
    return [
        {
            "id": t.id, "type": t.tx_type.value, "amount": float(t.amount),
            "balance_after": float(t.balance_after), "reference": t.reference,
            "ton_tx_hash": t.ton_tx_hash, "created_at": t.created_at.isoformat(),
        }
        for t in txs
    ]


# ── Tables CRUD ──

@router.post("/tables")
async def admin_create_table(
    body: CreateTableRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    table = PokerTable(
        name=body.name, max_players=body.max_players,
        small_blind=body.small_blind, big_blind=body.big_blind,
        min_buy_in=body.min_buy_in, max_buy_in=body.max_buy_in,
    )
    db.add(table)
    await db.flush()
    await db.refresh(table)
    return {"id": table.id, "name": table.name}


@router.put("/tables/{table_id}")
async def admin_update_table(
    table_id: int,
    body: UpdateTableRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(PokerTable).where(PokerTable.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if body.name is not None: table.name = body.name
    if body.max_players is not None: table.max_players = body.max_players
    if body.small_blind is not None: table.small_blind = body.small_blind
    if body.big_blind is not None: table.big_blind = body.big_blind
    if body.min_buy_in is not None: table.min_buy_in = body.min_buy_in
    if body.max_buy_in is not None: table.max_buy_in = body.max_buy_in
    if body.status is not None: table.status = TableStatus(body.status)

    await db.flush()
    return {"id": table.id, "name": table.name, "status": table.status.value}


@router.delete("/tables/{table_id}")
async def admin_delete_table(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Remove players first
    await db.execute(delete(TablePlayer).where(TablePlayer.table_id == table_id))
    result = await db.execute(select(PokerTable).where(PokerTable.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    await db.delete(table)
    await db.flush()
    return {"deleted": table_id}


# ── Tournaments CRUD ──

@router.post("/tournaments")
async def admin_create_tournament(
    body: CreateTournamentRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    t = Tournament(
        name=body.name, buy_in=body.buy_in, fee=body.fee,
        starting_stack=body.starting_stack, max_players=body.max_players,
        starts_at=body.starts_at,
    )
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return {"id": t.id, "name": t.name}


@router.put("/tournaments/{tournament_id}")
async def admin_update_tournament(
    tournament_id: int,
    body: UpdateTournamentRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if body.name is not None: t.name = body.name
    if body.buy_in is not None: t.buy_in = body.buy_in
    if body.fee is not None: t.fee = body.fee
    if body.max_players is not None: t.max_players = body.max_players
    if body.status is not None: t.status = TournamentStatus(body.status)
    if body.starts_at is not None: t.starts_at = body.starts_at

    await db.flush()
    return {"id": t.id, "name": t.name, "status": t.status.value}


@router.delete("/tournaments/{tournament_id}")
async def admin_delete_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    await db.execute(delete(TournamentPlayer).where(TournamentPlayer.tournament_id == tournament_id))
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    await db.delete(t)
    await db.flush()
    return {"deleted": tournament_id}
