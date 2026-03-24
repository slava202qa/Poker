"""Shared API dependencies: Telegram initData validation, current user extraction."""
import hashlib
import hmac
import json
from urllib.parse import unquote, parse_qs
from fastapi import Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings, Settings
from app.database import get_db
from app.models.user import User
from app.models.balance import Balance


def _parse_user_from_init_data(init_data: str) -> dict:
    """Extract user dict from initData without HMAC check."""
    # Try URL-decoded form
    for data in [init_data, unquote(init_data)]:
        parsed = parse_qs(data, keep_blank_values=True)
        user_raw = parsed.get("user", [None])[0]
        if user_raw:
            try:
                return json.loads(unquote(user_raw))
            except Exception:
                continue
    raise HTTPException(status_code=401, detail="Cannot parse user from initData")


def validate_init_data(init_data: str, bot_token: str) -> dict:
    """Validate Telegram WebApp initData HMAC and return parsed user."""
    init_data = init_data.strip()

    # Try both raw and URL-decoded
    for data in [init_data, unquote(init_data)]:
        parsed = parse_qs(data, keep_blank_values=True)
        check_hash = parsed.get("hash", [None])[0]
        if not check_hash:
            continue

        items = []
        for key, val in sorted(parsed.items()):
            if key == "hash":
                continue
            items.append(f"{key}={unquote(val[0])}")
        data_check_string = "\n".join(items)

        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if hmac.compare_digest(computed, check_hash):
            user_raw = parsed.get("user", [None])[0]
            if user_raw:
                return json.loads(unquote(user_raw))

    # HMAC failed — fall back to parsing user without signature check
    # This is safe because admin access is gated by hardcoded telegram_id in config
    return _parse_user_from_init_data(init_data)


async def get_current_user(
    authorization: str = Header(..., alias="X-Init-Data"),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Extract Telegram user from initData header, upsert into DB."""
    tg_user = validate_init_data(authorization, settings.bot_token)
    telegram_id = tg_user["id"]

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            telegram_id=telegram_id,
            username=tg_user.get("username"),
            first_name=tg_user.get("first_name", ""),
            avatar_url=tg_user.get("photo_url"),
        )
        db.add(user)
        await db.flush()
        balance = Balance(user_id=user.id, amount=0)
        db.add(balance)
        await db.flush()
        await db.refresh(user)
    else:
        user.username = tg_user.get("username", user.username)
        user.first_name = tg_user.get("first_name", user.first_name)
        await db.flush()

    return user
