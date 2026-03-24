"""
Internal API for bot-to-backend communication.
Not exposed to users — protected by X-Internal-Key header.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType, CurrencyType

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_internal(x_internal_key: str = Header(default="")):
    if x_internal_key != "bot-internal":
        raise HTTPException(status_code=403, detail="Forbidden")


class AdjustBalanceRequest(BaseModel):
    telegram_id: int
    amount: float  # positive = credit, negative = debit
    reference: str = ""


class ListenerCreditRequest(BaseModel):
    user_id: int       # internal DB user.id (not telegram_id)
    amount_rr: float
    ton_tx_hash: str


@router.post("/adjust_balance", dependencies=[Depends(verify_internal)])
async def adjust_balance(body: AdjustBalanceRequest, db: AsyncSession = Depends(get_db)):
    """Adjust user RR balance. Used by bot for buy/sell operations."""
    result = await db.execute(
        select(User).where(User.telegram_id == body.telegram_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    balance = user.balance
    if not balance:
        raise HTTPException(status_code=404, detail="Balance not found")

    new_amount = float(balance.amount) + body.amount
    if new_amount < 0:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    balance.amount = new_amount

    tx_type = TxType.DEPOSIT if body.amount > 0 else TxType.WITHDRAW
    tx = Transaction(
        user_id=user.id,
        currency=CurrencyType.CHIP,
        tx_type=tx_type,
        amount=body.amount,
        balance_after=new_amount,
        reference=body.reference,
    )
    db.add(tx)
    await db.flush()

    return {"status": "ok", "new_balance": new_amount}


@router.post("/listener_credit", dependencies=[Depends(verify_internal)])
async def listener_credit(body: ListenerCreditRequest, db: AsyncSession = Depends(get_db)):
    """Called by ton_listener.py when a matching on-chain deposit is confirmed."""
    # Idempotency check
    dup = await db.execute(
        select(Transaction).where(Transaction.ton_tx_hash == body.ton_tx_hash)
    )
    if dup.scalar_one_or_none():
        return {"status": "already_credited"}

    result = await db.execute(select(User).where(User.id == body.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    balance = user.balance
    balance.amount = float(balance.amount) + body.amount_rr

    tx = Transaction(
        user_id=user.id,
        currency=CurrencyType.CHIP,
        tx_type=TxType.DEPOSIT,
        amount=body.amount_rr,
        balance_after=float(balance.amount),
        ton_tx_hash=body.ton_tx_hash,
        reference="listener_deposit",
    )
    db.add(tx)
    await db.flush()
    return {"status": "credited", "new_balance": float(balance.amount)}
