from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType

router = APIRouter(prefix="/economy", tags=["economy"])


class BalanceResponse(BaseModel):
    balance: float
    wallet: str | None


class DepositNotify(BaseModel):
    """Called by TON listener when deposit detected."""
    ton_tx_hash: str
    amount: float


class WithdrawRequest(BaseModel):
    amount: float
    wallet_address: str


class TransactionResponse(BaseModel):
    id: int
    tx_type: str
    amount: float
    balance_after: float
    reference: str | None
    ton_tx_hash: str | None
    created_at: str


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: User = Depends(get_current_user)):
    return BalanceResponse(
        balance=float(user.balance.amount) if user.balance else 0,
        wallet=user.ton_wallet,
    )


@router.get("/transactions", response_model=list[TransactionResponse])
async def get_transactions(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    txs = result.scalars().all()
    return [
        TransactionResponse(
            id=t.id, tx_type=t.tx_type.value, amount=float(t.amount),
            balance_after=float(t.balance_after), reference=t.reference,
            ton_tx_hash=t.ton_tx_hash, created_at=t.created_at.isoformat(),
        )
        for t in txs
    ]


@router.post("/deposit/notify")
async def deposit_notify(
    body: DepositNotify,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Called after TON listener confirms a CHIP deposit.
    In production, this would be an internal endpoint called by ton_listener.
    """
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    balance = user.balance
    balance.amount = float(balance.amount) + body.amount

    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.DEPOSIT,
        amount=body.amount,
        balance_after=float(balance.amount),
        ton_tx_hash=body.ton_tx_hash,
    )
    db.add(tx)
    await db.flush()

    return {"status": "credited", "new_balance": float(balance.amount)}


@router.post("/withdraw")
async def withdraw(
    body: WithdrawRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Request CHIP withdrawal to TON wallet."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    balance = user.balance
    if float(balance.amount) < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    balance.amount = float(balance.amount) - body.amount

    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.WITHDRAW,
        amount=-body.amount,
        balance_after=float(balance.amount),
        reference=f"withdraw_to:{body.wallet_address}",
    )
    db.add(tx)
    await db.flush()

    # In production: trigger ton_withdraw.py to send CHIP on-chain
    # For now, mark as pending
    return {
        "status": "pending",
        "amount": body.amount,
        "to": body.wallet_address,
        "new_balance": float(balance.amount),
    }
