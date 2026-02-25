"""
TON blockchain listener for incoming CHIP (Jetton) deposits.
Polls the system wallet for new Jetton transfer transactions
and credits user balances off-chain.
"""
import asyncio
import logging
import httpx
from sqlalchemy import select
from app.config import get_settings
from app.database import async_session
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType

logger = logging.getLogger(__name__)

# Track last processed transaction to avoid duplicates
_last_lt: int = 0
_last_hash: str = ""


async def poll_deposits():
    """
    Long-running task that polls for new Jetton transfers to the system wallet.
    Should be started as a background task on app startup.
    """
    global _last_lt, _last_hash
    settings = get_settings()

    if not settings.system_wallet_address or not settings.ton_api_key:
        logger.warning("TON listener disabled: missing system wallet or API key")
        return

    logger.info("TON deposit listener started")

    while True:
        try:
            await _check_new_transactions(settings)
        except Exception as e:
            logger.error(f"TON listener error: {e}")

        await asyncio.sleep(10)  # Poll every 10 seconds


async def _check_new_transactions(settings):
    global _last_lt, _last_hash

    url = f"{settings.ton_api_url}/getTransactions"
    params = {
        "address": settings.system_wallet_address,
        "limit": 20,
    }
    if _last_lt:
        params["lt"] = _last_lt
        params["hash"] = _last_hash

    headers = {"X-API-Key": settings.ton_api_key}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            return

        data = resp.json()
        if not data.get("ok"):
            return

        transactions = data.get("result", [])

    for tx in transactions:
        lt = tx.get("transaction_id", {}).get("lt", 0)
        tx_hash = tx.get("transaction_id", {}).get("hash", "")

        if lt <= _last_lt:
            continue

        # Check if this is an incoming Jetton transfer
        in_msg = tx.get("in_msg", {})
        if not in_msg:
            continue

        # Jetton transfer notification has op code 0x7362d09c
        msg_body = in_msg.get("msg_data", {})
        source = in_msg.get("source", "")

        # Parse Jetton transfer details
        # In production, decode the message body to extract:
        # - sender's wallet address
        # - amount of CHIP transferred
        # - forward payload (could contain user's telegram_id)

        amount = _parse_jetton_amount(in_msg)
        sender_wallet = _parse_sender_wallet(in_msg)

        if amount > 0 and sender_wallet:
            await _credit_deposit(sender_wallet, amount, tx_hash)

        _last_lt = lt
        _last_hash = tx_hash


def _parse_jetton_amount(in_msg: dict) -> float:
    """
    Parse Jetton transfer amount from incoming message.
    In production, this decodes the BOC cell data.
    """
    # The value field in a Jetton notification contains the amount
    value = in_msg.get("value", "0")
    try:
        return int(value) / 1e9
    except (ValueError, TypeError):
        return 0.0


def _parse_sender_wallet(in_msg: dict) -> str:
    """Extract sender's TON wallet address from the message."""
    return in_msg.get("source", "")


async def _credit_deposit(wallet_address: str, amount: float, tx_hash: str):
    """Credit CHIP deposit to user's off-chain balance."""
    async with async_session() as session:
        # Find user by wallet
        result = await session.execute(
            select(User).where(User.ton_wallet == wallet_address)
        )
        user = result.scalar_one_or_none()
        if not user:
            logger.warning(f"Deposit from unknown wallet: {wallet_address}")
            return

        # Check for duplicate tx
        existing = await session.execute(
            select(Transaction).where(Transaction.ton_tx_hash == tx_hash)
        )
        if existing.scalar_one_or_none():
            return

        # Credit balance
        balance_result = await session.execute(
            select(Balance).where(Balance.user_id == user.id)
        )
        balance = balance_result.scalar_one_or_none()
        if not balance:
            balance = Balance(user_id=user.id, amount=0)
            session.add(balance)

        balance.amount = float(balance.amount) + amount

        tx = Transaction(
            user_id=user.id,
            tx_type=TxType.DEPOSIT,
            amount=amount,
            balance_after=float(balance.amount),
            ton_tx_hash=tx_hash,
            reference=f"from:{wallet_address}",
        )
        session.add(tx)
        await session.commit()

        logger.info(f"Credited {amount} CHIP to user {user.telegram_id} (tx: {tx_hash})")
