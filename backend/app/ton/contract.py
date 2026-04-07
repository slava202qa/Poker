"""
PokerVault contract interaction layer.

Handles:
- Building and sending deposit/withdrawal messages to the contract
- Finalizing tournaments: 10% fee deducted on-chain, prizes sent to winners
- Owner balance withdrawal to configured wallet

All amounts are in nanoTON internally.
RR <-> TON conversion uses settings.rate_ton_per_rr.

Contract address is read from settings.contract_address.
Owner key is read from settings.owner_mnemonic (24-word TON mnemonic).
"""
import asyncio
import logging
import struct
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Op codes — must match poker_vault.fc
OP_DEPOSIT          = 0x01
OP_TOURNAMENT_ENTRY = 0x02
OP_FINALIZE_TOURNEY = 0x03
OP_PLAYER_WITHDRAW  = 0x04
OP_OWNER_WITHDRAW   = 0xFF

NANO = 1_000_000_000  # 1 TON in nanoTON
GAS_AMOUNT = 50_000_000  # 0.05 TON for gas


@dataclass
class WinnerEntry:
    wallet_address: str   # TON wallet address (user-friendly or raw)
    prize_nano: int       # prize in nanoTON


async def _get_client():
    """Return a TonClient instance. Uses tonsdk or pytonlib if available."""
    try:
        from tonsdk.provider import ToncenterClient
        from app.config import get_settings
        s = get_settings()
        return ToncenterClient(
            base_url=s.toncenter_url,
            api_key=s.toncenter_api_key,
        )
    except ImportError:
        logger.warning("tonsdk not installed — contract calls are simulated")
        return None


async def _get_wallet():
    """Return (wallet, client) from owner mnemonic."""
    try:
        from tonsdk.contract.wallet import Wallets, WalletVersionEnum
        from tonsdk.utils import to_nano
        from app.config import get_settings
        s = get_settings()
        if not s.owner_mnemonic:
            logger.error("owner_mnemonic not set in config")
            return None, None
        mnemonics = s.owner_mnemonic.split()
        _mnemonics, pub_k, priv_k, wallet = Wallets.from_mnemonics(
            mnemonics, WalletVersionEnum.v4r2, 0
        )
        client = await _get_client()
        return wallet, client
    except Exception as e:
        logger.error(f"Failed to init owner wallet: {e}")
        return None, None


def _build_deposit_body(query_id: int) -> bytes:
    """op(4) + query_id(8) = 12 bytes."""
    return struct.pack(">IQ", OP_DEPOSIT, query_id)


def _build_player_withdraw_body(query_id: int, player_addr_raw: bytes, amount_nano: int) -> bytes:
    """op(4) + query_id(8) + addr(32) + amount(8) = 52 bytes."""
    return struct.pack(">IQ", OP_PLAYER_WITHDRAW, query_id) + player_addr_raw + struct.pack(">Q", amount_nano)


def _build_owner_withdraw_body(query_id: int, amount_nano: int) -> bytes:
    return struct.pack(">IQ", OP_OWNER_WITHDRAW, query_id) + struct.pack(">Q", amount_nano)


async def send_player_withdrawal(
    player_ton_address: str,
    amount_rr: float,
) -> dict:
    """
    Send TON to a player wallet from the contract.
    Called by the withdrawal processor after admin approval.

    Returns {"status": "sent", "tx_hash": "..."} or {"status": "error", "detail": "..."}
    """
    from app.config import get_settings
    s = get_settings()

    if not s.contract_address:
        logger.warning("contract_address not configured — skipping on-chain withdrawal")
        return {"status": "skipped", "detail": "contract_address not set"}

    amount_nano = int(amount_rr * s.rate_ton_per_rr * NANO)
    if amount_nano <= 0:
        return {"status": "error", "detail": "amount_nano <= 0"}

    wallet, client = await _get_wallet()
    if not wallet or not client:
        return {"status": "error", "detail": "wallet init failed"}

    try:
        import time
        query_id = int(time.time())

        # Encode player address to raw bytes for the message body
        from tonsdk.utils import Address
        addr = Address(player_ton_address)
        addr_bytes = bytes.fromhex(addr.hash_part.hex())

        body = _build_player_withdraw_body(query_id, addr_bytes, amount_nano)

        seqno = await client.run_get_method(
            address=wallet.address.to_string(),
            method="seqno",
            stack=[],
        )

        transfer = wallet.create_transfer_message(
            to_addr=s.contract_address,
            amount=GAS_AMOUNT,
            seqno=seqno,
            payload=body,
        )

        result = await client.send_boc(transfer["message"].to_boc(False))
        tx_hash = result.get("result", "unknown")
        logger.info(f"Player withdrawal sent: {player_ton_address} {amount_rr} RR tx={tx_hash}")
        return {"status": "sent", "tx_hash": tx_hash}

    except Exception as e:
        logger.error(f"send_player_withdrawal error: {e}")
        return {"status": "error", "detail": str(e)}


async def finalize_tournament_on_chain(
    tournament_id: int,
    total_pool_rr: float,
    winners: list[WinnerEntry],
) -> dict:
    """
    Finalize a tournament on-chain.
    Contract deducts 10% fee and sends prizes to winners.

    winners: list of WinnerEntry(wallet_address, prize_nano)
    total_pool_rr: total prize pool in RR (converted to nanoTON)
    """
    from app.config import get_settings
    s = get_settings()

    if not s.contract_address:
        logger.warning("contract_address not configured — skipping on-chain finalize")
        return {"status": "skipped", "detail": "contract_address not set"}

    total_pool_nano = int(total_pool_rr * s.rate_ton_per_rr * NANO)
    wallet, client = await _get_wallet()
    if not wallet or not client:
        return {"status": "error", "detail": "wallet init failed"}

    try:
        import time
        from tonsdk.utils import Address

        query_id = int(time.time())

        # Build body: op(4) + query_id(8) + tournament_id(4) + total_pool(8) + count(1)
        #             + [addr(32) + prize(8)] * N
        body = struct.pack(">IQ", OP_FINALIZE_TOURNEY, query_id)
        body += struct.pack(">IQB", tournament_id, total_pool_nano, len(winners))

        for w in winners:
            addr = Address(w.wallet_address)
            addr_bytes = bytes.fromhex(addr.hash_part.hex())
            body += addr_bytes + struct.pack(">Q", w.prize_nano)

        seqno = await client.run_get_method(
            address=wallet.address.to_string(),
            method="seqno",
            stack=[],
        )

        transfer = wallet.create_transfer_message(
            to_addr=s.contract_address,
            amount=GAS_AMOUNT,
            seqno=seqno,
            payload=body,
        )

        result = await client.send_boc(transfer["message"].to_boc(False))
        tx_hash = result.get("result", "unknown")
        logger.info(f"Tournament {tournament_id} finalized on-chain tx={tx_hash}")
        return {"status": "sent", "tx_hash": tx_hash}

    except Exception as e:
        logger.error(f"finalize_tournament_on_chain error: {e}")
        return {"status": "error", "detail": str(e)}


async def owner_withdraw_fees(amount_rr: float = 0) -> dict:
    """
    Withdraw accumulated platform fees from contract to owner wallet.
    amount_rr=0 means withdraw all.
    """
    from app.config import get_settings
    s = get_settings()

    if not s.contract_address:
        return {"status": "skipped", "detail": "contract_address not set"}

    amount_nano = int(amount_rr * s.rate_ton_per_rr * NANO) if amount_rr > 0 else 0

    wallet, client = await _get_wallet()
    if not wallet or not client:
        return {"status": "error", "detail": "wallet init failed"}

    try:
        import time
        query_id = int(time.time())
        body = _build_owner_withdraw_body(query_id, amount_nano)

        seqno = await client.run_get_method(
            address=wallet.address.to_string(),
            method="seqno",
            stack=[],
        )

        transfer = wallet.create_transfer_message(
            to_addr=s.contract_address,
            amount=GAS_AMOUNT,
            seqno=seqno,
            payload=body,
        )

        result = await client.send_boc(transfer["message"].to_boc(False))
        tx_hash = result.get("result", "unknown")
        logger.info(f"Owner fee withdrawal tx={tx_hash} amount_rr={amount_rr or 'all'}")
        return {"status": "sent", "tx_hash": tx_hash}

    except Exception as e:
        logger.error(f"owner_withdraw_fees error: {e}")
        return {"status": "error", "detail": str(e)}


async def get_contract_balance() -> int:
    """Return contract TON balance in nanoTON, or -1 on error."""
    from app.config import get_settings
    s = get_settings()
    if not s.contract_address:
        return -1
    try:
        client = await _get_client()
        if not client:
            return -1
        info = await client.get_address_information(s.contract_address)
        return int(info.get("balance", 0))
    except Exception as e:
        logger.error(f"get_contract_balance error: {e}")
        return -1
