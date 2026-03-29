"""Referral system API v2.

Bonus flow:
- Referred user gets welcome_bonus_rr immediately on first login via ref link
- Referrer gets referral_bonus_rr after referred user makes their first deposit
- Anti-fraud: block if referrer and referred share the same IP hash
"""
import hashlib
from fastapi import APIRouter, Depends, Request
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
    pending_rr: int       # bonuses not yet paid (waiting for deposit)
    bonus_per_friend: int
    welcome_bonus: int


@router.get("/stats", response_model=ReferralStats)
async def get_referral_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    ref_code = str(user.telegram_id)
    invite_url = f"https://t.me/{BOT_USERNAME}?start=ref{ref_code}"

    result = await db.execute(
        select(
            func.count(),
            func.sum(Referral.referrer_bonus).filter(Referral.referrer_bonus_paid == True),
            func.sum(Referral.referrer_bonus).filter(Referral.referrer_bonus_paid == False),
        ).where(Referral.referrer_id == user.id)
    )
    row = result.one()
    invited_count = int(row[0] or 0)
    earned_rr = int(row[1] or 0)
    pending_rr = int(row[2] or 0)

    return ReferralStats(
        ref_code=ref_code,
        invite_url=invite_url,
        invited_count=invited_count,
        earned_rr=earned_rr,
        pending_rr=pending_rr,
        bonus_per_friend=settings.referral_bonus_rr,
        welcome_bonus=settings.referral_welcome_rr,
    )


def _ip_hash(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()[:32]


async def process_referral(
    referred_user: User,
    ref_code: str,
    db: AsyncSession,
    settings: Settings,
    client_ip: str = "",
):
    """Called on new user first login. Gives welcome bonus, records referral."""
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

    # Idempotent
    existing = await db.execute(
        select(Referral).where(Referral.referred_id == referred_user.id)
    )
    if existing.scalar_one_or_none():
        return

    ip_h = _ip_hash(client_ip) if client_ip else None

    # Anti-fraud: check if referrer registered from same IP
    if ip_h:
        referrer_ref = await db.execute(
            select(Referral).where(
                Referral.referred_id == referrer.id,
                Referral.referred_ip_hash == ip_h,
            )
        )
        if referrer_ref.scalar_one_or_none():
            return  # Same IP as referrer's own registration — block

    welcome = settings.referral_welcome_rr

    referral = Referral(
        referrer_id=referrer.id,
        referred_id=referred_user.id,
        referrer_bonus=settings.referral_bonus_rr,
        referrer_bonus_paid=False,
        welcome_bonus=welcome,
        welcome_bonus_paid=False,
        referred_ip_hash=ip_h,
    )
    db.add(referral)

    # Give welcome bonus to referred user immediately
    if welcome > 0:
        bal_res = await db.execute(select(Balance).where(Balance.user_id == referred_user.id))
        bal = bal_res.scalar_one_or_none()
        if bal:
            bal.amount = float(bal.amount) + welcome
            db.add(Transaction(
                user_id=referred_user.id,
                tx_type=TxType.REFERRAL,
                amount=welcome,
                reference=f"welcome_bonus_ref_{referrer.telegram_id}",
            ))
            referral.welcome_bonus_paid = True

    await db.flush()


async def pay_referrer_bonus(referred_user_id: int, db: AsyncSession, settings: Settings):
    """Called after referred user's first deposit. Pays referrer bonus."""
    res = await db.execute(
        select(Referral).where(
            Referral.referred_id == referred_user_id,
            Referral.referrer_bonus_paid == False,
        )
    )
    referral = res.scalar_one_or_none()
    if not referral:
        return

    bonus = referral.referrer_bonus
    if bonus <= 0:
        return

    bal_res = await db.execute(select(Balance).where(Balance.user_id == referral.referrer_id))
    bal = bal_res.scalar_one_or_none()
    if bal:
        bal.amount = float(bal.amount) + bonus
        db.add(Transaction(
            user_id=referral.referrer_id,
            tx_type=TxType.REFERRAL,
            amount=bonus,
            reference=f"ref_bonus_from_{referred_user_id}",
        ))
        referral.referrer_bonus_paid = True
        await db.flush()
