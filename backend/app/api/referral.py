"""Referral system API."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.config import get_settings, Settings
from app.models.user import User
from app.models.referral import Referral
from app.models.balance import Balance, Transaction, TxType

router = APIRouter(prefix="/referral", tags=["referral"])

BOT_USERNAME = "POKER_VIP_1_Bot"


class ReferralStats(BaseModel):
    ref_code: str
    invite_url: str
    invited_count: int
    earned_rr: int
    bonus_per_friend: int


@router.get("/stats", response_model=ReferralStats)
async def get_referral_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    ref_code = str(user.telegram_id)
    invite_url = f"https://t.me/{BOT_USERNAME}?start=ref{ref_code}"

    result = await db.execute(
        select(func.count(), func.sum(Referral.bonus_paid))
        .where(Referral.referrer_id == user.id)
    )
    row = result.one()
    invited_count = int(row[0] or 0)
    earned_rr = int(row[1] or 0)

    return ReferralStats(
        ref_code=ref_code,
        invite_url=invite_url,
        invited_count=invited_count,
        earned_rr=earned_rr,
        bonus_per_friend=settings.referral_bonus_rr,
    )


async def process_referral(
    referred_user: User,
    ref_code: str,
    db: AsyncSession,
    settings: Settings,
):
    """Credit referrer when a new user joins via referral link."""
    try:
        referrer_tg_id = int(ref_code)
    except (ValueError, TypeError):
        return

    if referrer_tg_id == referred_user.telegram_id:
        return

    res = await db.execute(select(User).where(User.telegram_id == referrer_tg_id))
    referrer = res.scalar_one_or_none()
    if not referrer:
        return

    # Idempotent — one referral per referred user
    existing = await db.execute(
        select(Referral).where(Referral.referred_id == referred_user.id)
    )
    if existing.scalar_one_or_none():
        return

    bonus = settings.referral_bonus_rr

    db.add(Referral(
        referrer_id=referrer.id,
        referred_id=referred_user.id,
        bonus_paid=bonus,
    ))

    bal_res = await db.execute(select(Balance).where(Balance.user_id == referrer.id))
    bal = bal_res.scalar_one_or_none()
    if bal:
        bal.amount = float(bal.amount) + bonus
        db.add(Transaction(
            user_id=referrer.id,
            tx_type=TxType.REFERRAL,
            amount=bonus,
            reference=f"ref_bonus_from_{referred_user.telegram_id}",
        ))

    await db.flush()
