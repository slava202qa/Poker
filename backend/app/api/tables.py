from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.table import PokerTable, TablePlayer, TableStatus
from app.models.balance import Balance, Transaction, TxType

router = APIRouter(prefix="/tables", tags=["tables"])


class TableResponse(BaseModel):
    id: int
    name: str
    max_players: int
    small_blind: float
    big_blind: float
    min_buy_in: float
    max_buy_in: float
    status: str
    current_players: int

    class Config:
        from_attributes = True


class CreateTableRequest(BaseModel):
    name: str
    max_players: int = 9
    small_blind: float
    big_blind: float
    min_buy_in: float
    max_buy_in: float


class JoinTableRequest(BaseModel):
    buy_in: float
    seat: int


class SeatInfo(BaseModel):
    seat: int
    user_id: int
    username: str | None
    stack: float
    is_sitting_out: bool


@router.get("/", response_model=list[TableResponse])
async def list_tables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PokerTable).order_by(PokerTable.id))
    tables = result.scalars().all()
    return [
        TableResponse(
            id=t.id, name=t.name, max_players=t.max_players,
            small_blind=float(t.small_blind), big_blind=float(t.big_blind),
            min_buy_in=float(t.min_buy_in), max_buy_in=float(t.max_buy_in),
            status=t.status.value, current_players=t.current_players,
        )
        for t in tables
    ]


@router.post("/", response_model=TableResponse)
async def create_table(
    body: CreateTableRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    table = PokerTable(
        name=body.name,
        max_players=body.max_players,
        small_blind=body.small_blind,
        big_blind=body.big_blind,
        min_buy_in=body.min_buy_in,
        max_buy_in=body.max_buy_in,
    )
    db.add(table)
    await db.flush()
    await db.refresh(table)
    return TableResponse(
        id=table.id, name=table.name, max_players=table.max_players,
        small_blind=float(table.small_blind), big_blind=float(table.big_blind),
        min_buy_in=float(table.min_buy_in), max_buy_in=float(table.max_buy_in),
        status=table.status.value, current_players=table.current_players,
    )


@router.get("/{table_id}", response_model=TableResponse)
async def get_table(table_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PokerTable).where(PokerTable.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return TableResponse(
        id=table.id, name=table.name, max_players=table.max_players,
        small_blind=float(table.small_blind), big_blind=float(table.big_blind),
        min_buy_in=float(table.min_buy_in), max_buy_in=float(table.max_buy_in),
        status=table.status.value, current_players=table.current_players,
    )


@router.get("/{table_id}/seats", response_model=list[SeatInfo])
async def get_seats(table_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TablePlayer, User)
        .join(User, TablePlayer.user_id == User.id)
        .where(TablePlayer.table_id == table_id)
        .order_by(TablePlayer.seat)
    )
    rows = result.all()
    return [
        SeatInfo(
            seat=tp.seat, user_id=tp.user_id,
            username=u.username, stack=float(tp.stack),
            is_sitting_out=tp.is_sitting_out,
        )
        for tp, u in rows
    ]


@router.post("/{table_id}/join")
async def join_table(
    table_id: int,
    body: JoinTableRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Validate table
    result = await db.execute(select(PokerTable).where(PokerTable.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if table.current_players >= table.max_players:
        raise HTTPException(status_code=400, detail="Table is full")

    if body.buy_in < float(table.min_buy_in) or body.buy_in > float(table.max_buy_in):
        raise HTTPException(status_code=400, detail="Buy-in out of range")

    # Check seat availability
    existing = await db.execute(
        select(TablePlayer).where(
            TablePlayer.table_id == table_id, TablePlayer.seat == body.seat
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Seat taken")

    # Check already seated
    already = await db.execute(
        select(TablePlayer).where(
            TablePlayer.table_id == table_id, TablePlayer.user_id == user.id
        )
    )
    if already.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already at this table")

    # Deduct balance
    balance = user.balance
    if not balance or float(balance.amount) < body.buy_in:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    balance.amount = float(balance.amount) - body.buy_in

    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.BUY_IN,
        amount=-body.buy_in,
        balance_after=float(balance.amount),
        reference=f"table:{table_id}",
    )
    db.add(tx)

    tp = TablePlayer(
        table_id=table_id, user_id=user.id,
        seat=body.seat, stack=body.buy_in,
    )
    db.add(tp)
    table.current_players += 1

    await db.flush()
    return {"status": "joined", "seat": body.seat, "stack": body.buy_in}


@router.post("/{table_id}/leave")
async def leave_table(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TablePlayer).where(
            TablePlayer.table_id == table_id, TablePlayer.user_id == user.id
        )
    )
    tp = result.scalar_one_or_none()
    if not tp:
        raise HTTPException(status_code=400, detail="Not at this table")

    # Return stack to balance
    remaining_stack = float(tp.stack)
    balance = user.balance
    balance.amount = float(balance.amount) + remaining_stack

    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.CASH_OUT,
        amount=remaining_stack,
        balance_after=float(balance.amount),
        reference=f"table:{table_id}",
    )
    db.add(tx)

    table_result = await db.execute(select(PokerTable).where(PokerTable.id == table_id))
    table = table_result.scalar_one()
    table.current_players = max(0, table.current_players - 1)

    await db.delete(tp)
    await db.flush()
    return {"status": "left", "returned": remaining_stack}
