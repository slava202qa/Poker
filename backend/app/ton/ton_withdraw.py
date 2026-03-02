"""
CHIP (Jetton) withdrawal: sends tokens from system wallet to player's wallet.
Backend does NOT store private keys in code — mnemonics come from env.

Uses tonsdk to build and sign Jetton transfer messages, then broadcasts
via TON Center API.
"""
import asyncio
import base64
import hashlib
import logging
import struct
import time

import httpx
from tonsdk.contract.wallet import Wallets, WalletVersionEnum
from tonsdk.boc import Cell, begin_cell
from tonsdk.utils import Address, bytes_to_b64str, to_nano

from app.config import get_settings
from app.ton.jetton import get_jetton_wallet_address

logger = logging.getLogger(__name__)

# Jetton transfer op code
JETTON_TRANSFER_OP = 0x0F8A7EA5


def _build_jetton_transfer_body(
    to_address: str,
    response_address: str,
    jetton_amount: int,
    forward_amount: int = 1,
    forward_payload: bytes = b"",
    query_id: int = 0,
) -> Cell:
    """Build the Jetton transfer message body cell."""
    body = begin_cell()
    body.store_uint(JETTON_TRANSFER_OP, 32)  # op
    body.store_uint(query_id, 64)             # query_id
    body.store_coins(jetton_amount)           # amount of jettons
    body.store_address(Address(to_address))   # destination
    body.store_address(Address(response_address))  # response_destination
    body.store_bit(0)                         # no custom_payload
    body.store_coins(forward_amount)          # forward_ton_amount
    body.store_bit(0)                         # no forward_payload (inline)
    return body.end_cell()


async def send_jetton_transfer(
    to_address: str,
    amount: float,
    memo: str = "",
) -> str | None:
    """
    Send CHIP Jetton from system wallet to a player's wallet.
    Returns tx_hash on success, None on failure.
    """
    settings = get_settings()

    if not settings.ton_mnemonics:
        logger.error("Cannot withdraw: TON_MNEMONICS not configured")
        return None

    if not settings.jetton_master_address:
        logger.error("Cannot withdraw: JETTON_MASTER_ADDRESS not configured")
        return None

    mnemonics = settings.ton_mnemonics.split()
    if len(mnemonics) < 12:
        logger.error("Invalid mnemonics length")
        return None

    nano_amount = int(amount * 1e9)
    logger.info(f"Sending {amount} CHIP ({nano_amount} nano) to {to_address}")

    try:
        # Derive wallet from mnemonics
        _mnemonics, _pub_k, _priv_k, wallet = Wallets.from_mnemonics(
            mnemonics, WalletVersionEnum.v4r2, workchain=0
        )
        system_address = wallet.address.to_string(True, True, True)

        # Get the system wallet's Jetton wallet address
        jetton_wallet = await get_jetton_wallet_address(system_address)
        if not jetton_wallet:
            logger.error("Could not resolve system Jetton wallet address")
            return None

        # Build Jetton transfer body
        query_id = int(time.time())
        transfer_body = _build_jetton_transfer_body(
            to_address=to_address,
            response_address=system_address,
            jetton_amount=nano_amount,
            forward_amount=1,
            query_id=query_id,
        )

        # Get current seqno
        seqno = await _get_seqno(system_address, settings)
        if seqno is None:
            logger.error("Could not get wallet seqno")
            return None

        # Create transfer message to Jetton wallet contract
        # 0.05 TON for gas fees
        query = wallet.create_transfer_message(
            to_addr=jetton_wallet,
            amount=to_nano(0.05, "ton"),
            seqno=seqno,
            payload=transfer_body,
        )

        # Serialize and send
        boc = bytes_to_b64str(query["message"].to_boc())

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ton_api_url}/sendBoc",
                json={"boc": boc},
                headers={"X-API-Key": settings.ton_api_key},
                timeout=30,
            )

            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    tx_hash = data.get("result", {}).get("hash", f"sent_{query_id}")
                    logger.info(f"Jetton transfer sent: {tx_hash}")
                    return tx_hash
                else:
                    logger.error(f"sendBoc failed: {data}")
            else:
                logger.error(f"sendBoc HTTP {resp.status_code}: {resp.text}")

    except Exception as e:
        logger.error(f"Jetton transfer failed: {e}", exc_info=True)

    return None


async def _get_seqno(address: str, settings) -> int | None:
    """Get current seqno for the wallet."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ton_api_url}/runGetMethod",
                json={"address": address, "method": "seqno", "stack": []},
                headers={"X-API-Key": settings.ton_api_key},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    stack = data.get("result", {}).get("stack", [])
                    if stack:
                        val = stack[0][1]
                        return int(val, 16) if isinstance(val, str) else int(val)
    except Exception as e:
        logger.error(f"Failed to get seqno: {e}")
    return None


async def process_pending_withdrawals():
    """
    Background task: process queued withdrawals.
    Reads pending withdrawal transactions from DB and sends them on-chain.
    """
    from sqlalchemy import select
    from app.database import async_session
    from app.models.balance import Transaction, TxType

    try:
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

                wallet = tx.reference.replace("withdraw_to:", "")
                amount = abs(float(tx.amount))

                tx_hash = await send_jetton_transfer(wallet, amount)
                if tx_hash:
                    tx.ton_tx_hash = tx_hash
                    logger.info(f"Withdrawal processed: {tx_hash}")
                else:
                    logger.warning(f"Withdrawal failed for tx {tx.id}, will retry")

            await session.commit()
    except Exception as e:
        logger.error(f"process_pending_withdrawals error: {e}")
