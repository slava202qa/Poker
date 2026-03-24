"""
Economy API: balances, deposits (with payment details), withdrawals, FUN refill.

Deposit flow:
  1. POST /economy/deposit/init  → returns wallet address, unique comment, QR data
  2. Blockchain listener (ton_listener.py) polls TonCenter, matches comment → credits balance

Withdrawal flow:
  1. POST /economy/withdraw       → deducts balance instantly, creates pending Transaction
  2. Admin approves via /admin/transfers/approve/{tx_id}
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.config import get_settings, Settings
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType, CurrencyType

router = APIRouter(prefix="/economy", tags=["economy"])

FUN_REFILL_AMOUNT = 10_000
FUN_REFILL_COOLDOWN_HOURS = 4
FUN_REFILL_THRESHOLD = 1_000


# ── Schemas ──────────────────────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    balance: float
    fun_balance: float
    wallet: str | None

class RatesResponse(BaseModel):
    rate_usdt_per_rr: float
    rate_ton_per_rr: float
    rr_per_usdt: float
    rr_per_ton: float

class DepositInitRequest(BaseModel):
    amount_rr: float
    currency: str  # "ton" | "usdt"

class DepositInitResponse(BaseModel):
    wallet_address: str
    amount_crypto: float
    currency: str
    comment: str
    qr_data: str
    amount_rr: float

class WithdrawRequest(BaseModel):
    amount_rr: float
    currency: str   # "ton" | "usdt"
    wallet_address: str

class WithdrawResponse(BaseModel):
    status: str
    amount_rr: float
    amount_crypto: float
    currency: str
    to: str
    new_balance: float
    tx_id: int

class TransactionResponse(BaseModel):
    id: int
    tx_type: str
    amount: float
    balance_after: float
    reference: str | None
    ton_tx_hash: str | None
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_comment(user_id: int, currency: str) -> str:
    day = datetime.date.today().strftime("%m%d")
    return f"RR{user_id}{currency.upper()}{day}"

def _ton_qr(wallet: str, amount_ton: float, comment: str) -> str:
    nano = int(amount_ton * 1_000_000_000)
    return f"ton://transfer/{wallet}?amount={nano}&text={comment}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/rates", response_model=RatesResponse)
async def get_rates(settings: Settings = Depends(get_settings)):
    return RatesResponse(
        rate_usdt_per_rr=settings.rate_usdt_per_rr,
        rate_ton_per_rr=settings.rate_ton_per_rr,
        rr_per_usdt=round(1 / settings.rate_usdt_per_rr, 2),
        rr_per_ton=round(1 / settings.rate_ton_per_rr, 2),
    )


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: User = Depends(get_current_user)):
    return BalanceResponse(
        balance=float(user.balance.amount) if user.balance else 0,
        fun_balance=float(user.balance.fun_amount) if user.balance else 0,
        wallet=user.ton_wallet,
    )


@router.post("/deposit/init", response_model=DepositInitResponse)
async def deposit_init(
    body: DepositInitRequest,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if body.amount_rr < 10:
        raise HTTPException(status_code=400, detail="Минимум 10 RR")
    if body.currency not in ("ton", "usdt"):
        raise HTTPException(status_code=400, detail="currency must be ton or usdt")
    if not settings.system_wallet_address:
        raise HTTPException(status_code=503, detail="Wallet not configured")

    rate = settings.rate_ton_per_rr if body.currency == "ton" else settings.rate_usdt_per_rr
    amount_crypto = round(body.amount_rr * rate, 6)
    comment = _make_comment(user.id, body.currency)

    if body.currency == "ton":
        qr_data = _ton_qr(settings.system_wallet_address, amount_crypto, comment)
    else:
        qr_data = f"usdt:{settings.system_wallet_address}?amount={amount_crypto}&memo={comment}"

    return DepositInitResponse(
        wallet_address=settings.system_wallet_address,
        amount_crypto=amount_crypto,
        currency=body.currency.upper(),
        comment=comment,
        qr_data=qr_data,
        amount_rr=body.amount_rr,
    )


@router.post("/deposit/confirm")
async def deposit_confirm(
    ton_tx_hash: str,
    amount_rr: float,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Called by blockchain listener after verifying tx on-chain."""
    if amount_rr <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    existing = await db.execute(
        select(Transaction).where(Transaction.ton_tx_hash == ton_tx_hash)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_credited"}

    balance = user.balance
    balance.amount = float(balance.amount) + amount_rr
    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.DEPOSIT,
        amount=amount_rr,
        balance_after=float(balance.amount),
        ton_tx_hash=ton_tx_hash,
        reference="deposit_confirmed",
    )
    db.add(tx)
    await db.flush()
    return {"status": "credited", "new_balance": float(balance.amount)}


@router.post("/withdraw", response_model=WithdrawResponse)
async def withdraw(
    body: WithdrawRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if body.amount_rr < 10:
        raise HTTPException(status_code=400, detail="Минимум 10 RR")
    if body.currency not in ("ton", "usdt"):
        raise HTTPException(status_code=400, detail="currency must be ton or usdt")
    if not body.wallet_address.strip():
        raise HTTPException(status_code=400, detail="Укажите адрес кошелька")

    balance = user.balance
    current = float(balance.amount)
    if current < body.amount_rr:
        raise HTTPException(status_code=400, detail="Недостаточно Клубных Активов")

    rate = settings.rate_ton_per_rr if body.currency == "ton" else settings.rate_usdt_per_rr
    amount_crypto = round(body.amount_rr * rate, 6)
    amount_usd = body.amount_rr * settings.rate_usdt_per_rr
    review_flag = "auto" if amount_usd < settings.auto_pay_usd_limit else "manual"

    balance.amount = current - body.amount_rr

    tx = Transaction(
        user_id=user.id,
        tx_type=TxType.WITHDRAW,
        amount=-body.amount_rr,
        balance_after=float(balance.amount),
        reference=f"withdraw:{body.currency}:{amount_crypto}:{body.wallet_address}:{review_flag}:pending",
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)

    return WithdrawResponse(
        status="pending",
        amount_rr=body.amount_rr,
        amount_crypto=amount_crypto,
        currency=body.currency.upper(),
        to=body.wallet_address,
        new_balance=float(balance.amount),
        tx_id=tx.id,
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


@router.post("/fun/refill")
async def refill_fun(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    balance = user.balance
    current_fun = float(balance.fun_amount)

    if current_fun >= FUN_REFILL_THRESHOLD:
        raise HTTPException(status_code=400, detail=f"Баланс BR должен быть ниже {FUN_REFILL_THRESHOLD}")

    now = datetime.datetime.now(datetime.timezone.utc)
    if balance.fun_last_refill:
        elapsed = (now - balance.fun_last_refill).total_seconds()
        remaining = FUN_REFILL_COOLDOWN_HOURS * 3600 - elapsed
        if remaining > 0:
            mins = int(remaining // 60)
            raise HTTPException(status_code=400, detail=f"Пополнение через {mins} мин.")

    balance.fun_amount = current_fun + FUN_REFILL_AMOUNT
    balance.fun_last_refill = now

    tx = Transaction(
        user_id=user.id,
        currency=CurrencyType.FUN,
        tx_type=TxType.FUN_REFILL,
        amount=FUN_REFILL_AMOUNT,
        balance_after=float(balance.fun_amount),
        reference="fun_refill",
    )
    db.add(tx)
    await db.flush()

    return {"status": "refilled", "fun_balance": float(balance.fun_amount)}
