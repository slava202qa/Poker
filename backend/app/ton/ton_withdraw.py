"""
CHIP (Jetton) withdrawal: sends tokens from system wallet to player's wallet.
Backend does NOT store private keys in code — mnemonics come from env.
"""
import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_jetton_transfer(
    to_address: str,
    amount: float,
    memo: str = "",
) -> str | None:
    """
    Send CHIP Jetton from system wallet to a player's wallet.

    In production, this would:
    1. Derive keypair from TON_MNEMONICS
    2. Build a Jetton transfer message
    3. Sign and send the transaction
    4. Return the transaction hash

    Returns tx_hash on success, None on failure.
    """
    settings = get_settings()

    if not settings.ton_mnemonics:
        logger.error("Cannot withdraw: TON_MNEMONICS not configured")
        return None

    nano_amount = int(amount * 1e9)

    logger.info(f"Sending {amount} CHIP ({nano_amount} nano) to {to_address}")

    # Production implementation would use tonsdk or pytoniq:
    #
    # from tonsdk.contract.wallet import Wallets, WalletVersionEnum
    # from tonsdk.utils import to_nano, bytes_to_b64str
    #
    # mnemonics = settings.ton_mnemonics.split()
    # _mnemonics, _pub_k, _priv_k, wallet = Wallets.from_mnemonics(
    #     mnemonics, WalletVersionEnum.v4r2, workchain=0
    # )
    #
    # # Build Jetton transfer body
    # jetton_transfer = JettonTransferBody(
    #     jetton_amount=nano_amount,
    #     to_address=Address(to_address),
    #     response_address=Address(settings.system_wallet_address),
    #     forward_amount=1,  # for notification
    #     forward_payload=memo.encode() if memo else b"",
    # )
    #
    # # Create and sign external message
    # query = wallet.create_transfer_message(
    #     to_addr=jetton_wallet_address,
    #     amount=to_nano(0.05, "ton"),  # gas
    #     payload=jetton_transfer,
    # )
    #
    # # Send via TON Center
    # boc = bytes_to_b64str(query["message"].to_boc())
    # resp = await client.post(f"{settings.ton_api_url}/sendBoc", json={"boc": boc})

    # Stub: return a placeholder hash
    logger.warning("TON withdrawal stub — configure TON_MNEMONICS for real transfers")
    return None


async def process_pending_withdrawals():
    """
    Background task to process queued withdrawals.
    In production, reads pending withdrawal transactions from DB and sends them.
    """
    from sqlalchemy import select
    from app.database import async_session
    from app.models.balance import Transaction, TxType

    async with async_session() as session:
        result = await session.execute(
            select(Transaction)
            .where(
                Transaction.tx_type == TxType.WITHDRAW,
                Transaction.ton_tx_hash.is_(None),
            )
            .limit(10)
        )
        pending = result.scalars().all()

        for tx in pending:
            if not tx.reference:
                continue

            # Extract wallet from reference "withdraw_to:UQ..."
            wallet = tx.reference.replace("withdraw_to:", "")
            amount = abs(float(tx.amount))

            tx_hash = await send_jetton_transfer(wallet, amount)
            if tx_hash:
                tx.ton_tx_hash = tx_hash
                logger.info(f"Withdrawal processed: {tx_hash}")

        await session.commit()
