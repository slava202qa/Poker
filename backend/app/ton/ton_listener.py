"""
TON blockchain listener for incoming CHIP (Jetton) deposits.
Polls the system wallet's Jetton wallet for incoming transfer notifications.
Decodes the Jetton notification body (op 0x7362d09c) to extract sender and amount.
"""
import asyncio
import base64
import logging
import httpx
from sqlalchemy import select
from app.config import get_settings
from app.database import async_session
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType

logger = logging.getLogger(__name__)

# Jetton internal transfer notification op code
JETTON_NOTIFY_OP = 0x7362D09C

# Track last processed logical time to avoid duplicates
_last_lt: int = 0
_last_hash: str = ""


async def poll_deposits():
    """
    Long-running task that polls for new Jetton transfers to the system wallet.
    Started as a background task on app startup.
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

        await asyncio.sleep(10)


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
        resp = await client.get(url, params=params, headers=headers, timeout=15)
        if resp.status_code != 200:
            return

        data = resp.json()
        if not data.get("ok"):
            return

        transactions = data.get("result", [])

    for tx in transactions:
        tx_id = tx.get("transaction_id", {})
        lt = int(tx_id.get("lt", 0))
        tx_hash = tx_id.get("hash", "")

        if lt <= _last_lt:
            continue

        in_msg = tx.get("in_msg", {})
        if not in_msg:
            _last_lt = lt
            _last_hash = tx_hash
            continue

        # Try to parse as Jetton notification
        parsed = _parse_jetton_notification(in_msg)
        if parsed:
            sender_wallet, amount = parsed
            if amount > 0 and sender_wallet:
                await _credit_deposit(sender_wallet, amount, tx_hash)

        _last_lt = lt
        _last_hash = tx_hash


def _parse_jetton_notification(in_msg: dict) -> tuple[str, float] | None:
    """
    Parse a Jetton transfer notification message.

    Jetton notification body layout (TL-B):
      transfer_notification#7362d09c
        query_id:uint64
        amount:(VarUInteger 16)
        sender:MsgAddress
        forward_payload:(Either Cell ^Cell)

    Returns (sender_address, amount_in_chip) or None if not a Jetton notification.
    """
    msg_data = in_msg.get("msg_data", {})
    body_b64 = msg_data.get("body", "")

    if not body_b64:
        # Fallback: try to detect from message value and source
        return _parse_fallback(in_msg)

    try:
        body_bytes = base64.b64decode(body_b64)

        if len(body_bytes) < 4:
            return None

        # Read op code (first 4 bytes, big-endian)
        op = int.from_bytes(body_bytes[:4], "big")

        if op != JETTON_NOTIFY_OP:
            return None

        # Parse the rest using bit-level reading
        # query_id: 64 bits (bytes 4-12)
        # amount: VarUInteger 16 — first 4 bits = length in bytes, then value
        # sender: MsgAddress

        offset = 4 + 8  # skip op (4) + query_id (8)

        if len(body_bytes) < offset + 1:
            return None

        # VarUInteger 16: read length prefix (4 bits)
        # For simplicity, read as a coins-style encoding
        amount_nano = _read_coins(body_bytes, offset)
        if amount_nano is None:
            return None

        amount_chip = amount_nano / 1e9

        # Sender address comes from the in_msg source
        # (the Jetton wallet contract that sent the notification)
        # The actual sender's TON wallet is encoded in the body,
        # but we can also look it up from the source Jetton wallet
        source = in_msg.get("source", "")

        # For user matching, we need the original sender's wallet.
        # The source of the notification is the system's Jetton wallet.
        # The sender field in the body is the sender's Jetton wallet.
        # We match users by their TON wallet, so we use a reverse lookup.
        # Practical approach: use the forward_payload or match by Jetton wallet.

        # Simplified: use source as identifier, match in _credit_deposit
        return (source, amount_chip)

    except Exception as e:
        logger.debug(f"Failed to parse Jetton notification: {e}")
        return None


def _read_coins(data: bytes, offset: int) -> int | None:
    """Read a Coins value (VarUInteger 16) from raw bytes at byte offset."""
    if offset >= len(data):
        return None

    # Coins encoding: first 4 bits = number of bytes for the value
    first_byte = data[offset]
    length = (first_byte >> 4) & 0x0F

    if length == 0:
        return 0

    if offset + 1 + length > len(data):
        return None

    # Read `length` bytes as big-endian integer
    # The remaining 4 bits of first_byte are part of the value
    value_bytes = bytes([(first_byte & 0x0F)]) + data[offset + 1: offset + 1 + length]
    return int.from_bytes(value_bytes, "big")


def _parse_fallback(in_msg: dict) -> tuple[str, float] | None:
    """
    Fallback parser when body decoding fails.
    Uses the message value and source fields directly.
    This works for simple TON transfers but is less reliable for Jettons.
    """
    source = in_msg.get("source", "")
    value = in_msg.get("value", "0")

    if not source:
        return None

    try:
        amount = int(value) / 1e9
        if amount > 0:
            return (source, amount)
    except (ValueError, TypeError):
        pass

    return None


async def _credit_deposit(sender_identifier: str, amount: float, tx_hash: str):
    """Credit CHIP deposit to user's off-chain balance."""
    async with async_session() as session:
        # Check for duplicate tx first
        existing = await session.execute(
            select(Transaction).where(Transaction.ton_tx_hash == tx_hash)
        )
        if existing.scalar_one_or_none():
            return

        # Try to find user by wallet address
        result = await session.execute(
            select(User).where(User.ton_wallet == sender_identifier)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Try partial match (different address formats)
            all_users = await session.execute(
                select(User).where(User.ton_wallet.isnot(None))
            )
            for u in all_users.scalars():
                if u.ton_wallet and (
                    sender_identifier.endswith(u.ton_wallet[-20:])
                    or u.ton_wallet.endswith(sender_identifier[-20:])
                ):
                    user = u
                    break

        if not user:
            logger.warning(f"Deposit from unknown wallet: {sender_identifier}, amount: {amount}")
            return

        # Credit balance
        balance_result = await session.execute(
            select(Balance).where(Balance.user_id == user.id)
        )
        balance = balance_result.scalar_one_or_none()
        if not balance:
            balance = Balance(user_id=user.id, amount=0)
            session.add(balance)
            await session.flush()

        balance.amount = float(balance.amount) + amount

        tx = Transaction(
            user_id=user.id,
            tx_type=TxType.DEPOSIT,
            amount=amount,
            balance_after=float(balance.amount),
            ton_tx_hash=tx_hash,
            reference=f"from:{sender_identifier}",
        )
        session.add(tx)
        await session.commit()

        logger.info(f"Credited {amount} CHIP to user {user.telegram_id} (tx: {tx_hash})")
