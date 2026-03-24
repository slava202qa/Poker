"""
TON Blockchain Listener — polls TonCenter for incoming transactions on the
system wallet, matches the payment comment to a player, and credits their
RR balance via the internal deposit/confirm endpoint.

Run as a separate process (see docker-compose service: ton_listener).
"""
import asyncio
import logging
import os
import re
import httpx
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [listener] %(message)s")
log = logging.getLogger(__name__)

BACKEND_URL       = os.getenv("BACKEND_URL", "http://backend:8000")
TON_API_URL       = os.getenv("TON_API_URL", "https://toncenter.com/api/v2")
TON_API_KEY       = os.getenv("TON_API_KEY", "")
SYSTEM_WALLET     = os.getenv("SYSTEM_WALLET_ADDRESS", "")
RATE_TON_PER_RR   = float(os.getenv("RATE_TON_PER_RR",  "0.01724"))
RATE_USDT_PER_RR  = float(os.getenv("RATE_USDT_PER_RR", "0.0227"))
INTERNAL_KEY      = os.getenv("INTERNAL_KEY", "bot-internal")
POLL_INTERVAL     = int(os.getenv("LISTENER_POLL_SECONDS", "30"))

# Comment pattern: RR<user_id><TON|USDT><MMDD>
COMMENT_RE = re.compile(r"^RR(\d+)(TON|USDT)(\d{4})$")

# Track last processed lt (logical time) to avoid re-processing
_last_lt: int = 0


async def fetch_transactions(client: httpx.AsyncClient) -> list[dict]:
    params = {"address": SYSTEM_WALLET, "limit": 20}
    if TON_API_KEY:
        params["api_key"] = TON_API_KEY
    try:
        r = await client.get(f"{TON_API_URL}/getTransactions", params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        return data.get("result", [])
    except Exception as e:
        log.warning(f"TonCenter fetch error: {e}")
        return []


async def credit_player(client: httpx.AsyncClient, user_id: int, amount_rr: float, tx_hash: str):
    """Call internal backend endpoint to credit the player."""
    try:
        r = await client.post(
            f"{BACKEND_URL}/api/internal/listener_credit",
            json={"user_id": user_id, "amount_rr": amount_rr, "ton_tx_hash": tx_hash},
            headers={"X-Internal-Key": INTERNAL_KEY},
            timeout=10,
        )
        if r.status_code == 200:
            log.info(f"Credited {amount_rr} RR to user {user_id} (tx {tx_hash[:12]}...)")
        else:
            log.warning(f"Credit failed {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.error(f"Credit request error: {e}")


async def process_tx(client: httpx.AsyncClient, tx: dict):
    global _last_lt

    lt = int(tx.get("transaction_id", {}).get("lt", 0))
    if lt <= _last_lt:
        return
    _last_lt = max(_last_lt, lt)

    # Only incoming (in_msg present, source != our wallet)
    in_msg = tx.get("in_msg", {})
    if not in_msg or in_msg.get("source") == SYSTEM_WALLET:
        return

    value_nano = int(in_msg.get("value", 0))
    if value_nano <= 0:
        return

    comment = in_msg.get("message", "").strip()
    tx_hash = tx.get("transaction_id", {}).get("hash", "")

    m = COMMENT_RE.match(comment)
    if not m:
        log.debug(f"No matching comment: '{comment}'")
        return

    user_id   = int(m.group(1))
    currency  = m.group(2)   # TON or USDT
    amount_ton = value_nano / 1_000_000_000

    # Convert to RR
    if currency == "TON":
        amount_rr = round(amount_ton / RATE_TON_PER_RR, 2)
    else:
        # USDT via Jetton — value_nano is in nanoUSDT (6 decimals)
        amount_usdt = value_nano / 1_000_000
        amount_rr = round(amount_usdt / RATE_USDT_PER_RR, 2)

    log.info(f"Match: user={user_id} currency={currency} amount_rr={amount_rr} tx={tx_hash[:12]}")
    await credit_player(client, user_id, amount_rr, tx_hash)


async def main():
    if not SYSTEM_WALLET:
        log.error("SYSTEM_WALLET_ADDRESS not set — listener idle")
        while True:
            await asyncio.sleep(60)

    log.info(f"Listening on wallet {SYSTEM_WALLET[:12]}... every {POLL_INTERVAL}s")
    async with httpx.AsyncClient() as client:
        while True:
            txs = await fetch_transactions(client)
            for tx in reversed(txs):   # oldest first
                await process_tx(client, tx)
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
