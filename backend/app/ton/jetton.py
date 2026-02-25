"""
CHIP Jetton (TON token) utilities.
Handles address resolution and balance queries via TON Center API.
"""
import httpx
from app.config import get_settings


async def get_jetton_wallet_address(owner_address: str) -> str | None:
    """
    Get the Jetton wallet address for a given owner.
    Each user has a unique Jetton wallet contract for each Jetton type.
    """
    settings = get_settings()
    url = f"{settings.ton_api_url}/runGetMethod"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json={
                "address": settings.jetton_master_address,
                "method": "get_wallet_address",
                "stack": [["tvm.Slice", owner_address]],
            }, headers={"X-API-Key": settings.ton_api_key})

            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    # Parse the result stack to get wallet address
                    stack = data.get("result", {}).get("stack", [])
                    if stack:
                        return stack[0][1].get("object", {}).get("data", {}).get("b64", "")
    except Exception:
        pass

    return None


async def get_jetton_balance(jetton_wallet_address: str) -> float:
    """Query on-chain Jetton balance for a wallet."""
    settings = get_settings()
    url = f"{settings.ton_api_url}/runGetMethod"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json={
                "address": jetton_wallet_address,
                "method": "get_wallet_data",
                "stack": [],
            }, headers={"X-API-Key": settings.ton_api_key})

            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    stack = data.get("result", {}).get("stack", [])
                    if stack:
                        # First element is balance in nano-units
                        raw_balance = int(stack[0][1], 16) if isinstance(stack[0][1], str) else stack[0][1]
                        return raw_balance / 1e9  # Convert from nano
    except Exception:
        pass

    return 0.0
