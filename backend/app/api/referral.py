"""Syndicate (referral) system API.

Bonus structure:
- Referred user gets welcome_bonus_rr immediately on first login via ref link
- Referred user gets +5% of their first deposit credited to their balance
- Referrer gets referral_bonus_rr after referred user makes their first deposit
- Level 1: referrer earns 10% of rake from directly invited agents
- Level 2: referrer earns 3% of rake from agents invited by their agents
- Accumulated rake bonuses sit in bonus_balance until user claims them
- Anti-fraud: block if referrer and referred share the same IP hash
"""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.config import get_settings, Settings
from app.models.user import User
from app.models.referral import Referral
from app.models.balance import Balance, Transaction, TxType, CurrencyType

router = APIRouter(prefix="/referral", tags=["referral"])

BOT_USERNAME = "POKER_VIP_1_Bot"

RAKE_SHARE_L1 = 0.20   # Level 1: 20% of rake from direct agents
RAKE_SHARE_L2 = 0.05   # Level 2: 5% of rake from agents of agents
FIRST_DEPOSIT_BONUS_PCT = 0.05


class ReferralStats(BaseModel):
    ref_code: str
    invite_url: str
    invited_count: int
    earned_rr: int
    pending_rr: int
    bonus_balance: float
    bonus_per_friend: int
    welcome_bonus: int
    agents: list[dict]


class ClaimResponse(BaseModel):
    claimed: float
    new_balance: float


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

    bal_res = await db.execute(select(Balance).where(Balance.user_id == user.id))
    bal = bal_res.scalar_one_or_none()
    bonus_balance = float(bal.bonus_balance) if bal else 0.0

    agents_res = await db.execute(
        select(Referral, User)
        .join(User, Referral.referred_id == User.id)
        .where(Referral.referrer_id == user.id)
        .order_by(Referral.created_at.desc())
        .limit(50)
    )
    agents = []
    for ref, referred_user in agents_res.all():
        agents.append({
            "telegram_id": referred_user.telegram_id,
            "username": referred_user.username,
            "first_name": referred_user.first_name,
            "joined_at": ref.created_at.isoformat(),
            "deposit_made": ref.referrer_bonus_paid,
        })

    return ReferralStats(
        ref_code=ref_code,
        invite_url=invite_url,
        invited_count=invited_count,
        earned_rr=earned_rr,
        pending_rr=pending_rr,
        bonus_balance=bonus_balance,
        bonus_per_friend=settings.referral_bonus_rr,
        welcome_bonus=settings.referral_welcome_rr,
        agents=agents,
    )


@router.post("/claim", response_model=ClaimResponse)
async def claim_bonus(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transfer accumulated bonus_balance to main balance."""
    bal_res = await db.execute(select(Balance).where(Balance.user_id == user.id))
    bal = bal_res.scalar_one_or_none()
    if not bal or float(bal.bonus_balance) <= 0:
        raise HTTPException(status_code=400, detail="Нет бонусов для получения")

    amount = float(bal.bonus_balance)
    bal.amount = float(bal.amount) + amount
    bal.bonus_balance = 0

    db.add(Transaction(currency=CurrencyType.CHIP, 
        user_id=user.id,
        tx_type=TxType.SYNDICATE_CLAIM,
        amount=amount,
        balance_after=float(bal.amount),
        reference="syndicate_claim",
    ))
    await db.commit()
    return ClaimResponse(claimed=amount, new_balance=float(bal.amount))


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

    existing = await db.execute(
        select(Referral).where(Referral.referred_id == referred_user.id)
    )
    if existing.scalar_one_or_none():
        return

    ip_h = _ip_hash(client_ip) if client_ip else None

    if ip_h:
        referrer_ref = await db.execute(
            select(Referral).where(
                Referral.referred_id == referrer.id,
                Referral.referred_ip_hash == ip_h,
            )
        )
        if referrer_ref.scalar_one_or_none():
            return

    welcome = settings.referral_welcome_rr

    referral = Referral(
        referrer_id=referrer.id,
        referred_id=referred_user.id,
        referrer_bonus=settings.referral_bonus_rr,
        referrer_bonus_paid=False,
        welcome_bonus=welcome,
        welcome_bonus_paid=False,
        first_deposit_bonus_paid=False,
        referred_ip_hash=ip_h,
    )
    db.add(referral)

    if welcome > 0:
        bal_res = await db.execute(select(Balance).where(Balance.user_id == referred_user.id))
        bal = bal_res.scalar_one_or_none()
        if bal:
            bal.amount = float(bal.amount) + welcome
            db.add(Transaction(currency=CurrencyType.CHIP, 
                user_id=referred_user.id,
                tx_type=TxType.REFERRAL,
                amount=welcome,
                balance_after=float(bal.amount),
                reference=f"welcome_bonus_ref_{referrer.telegram_id}",
            ))
            referral.welcome_bonus_paid = True

    await db.flush()


async def pay_referrer_bonus(referred_user_id: int, deposit_amount: float, db: AsyncSession, settings: Settings):
    """Called after referred user's first deposit."""
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
    if bonus > 0:
        bal_res = await db.execute(select(Balance).where(Balance.user_id == referral.referrer_id))
        bal = bal_res.scalar_one_or_none()
        if bal:
            bal.amount = float(bal.amount) + bonus
            db.add(Transaction(currency=CurrencyType.CHIP, 
                user_id=referral.referrer_id,
                tx_type=TxType.REFERRAL,
                amount=bonus,
                balance_after=float(bal.amount),
                reference=f"ref_bonus_from_{referred_user_id}",
            ))
            referral.referrer_bonus_paid = True

    if not referral.first_deposit_bonus_paid and deposit_amount > 0:
        first_dep_bonus = round(deposit_amount * FIRST_DEPOSIT_BONUS_PCT, 4)
        if first_dep_bonus > 0:
            bal_res = await db.execute(select(Balance).where(Balance.user_id == referred_user_id))
            bal = bal_res.scalar_one_or_none()
            if bal:
                bal.amount = float(bal.amount) + first_dep_bonus
                db.add(Transaction(currency=CurrencyType.CHIP, 
                    user_id=referred_user_id,
                    tx_type=TxType.REFERRAL,
                    amount=first_dep_bonus,
                    balance_after=float(bal.amount),
                    reference="first_deposit_bonus_5pct",
                ))
                referral.first_deposit_bonus_paid = True

    await db.flush()


async def distribute_rake_syndicate(
    player_user_id: int,
    rake_amount: float,
    db: AsyncSession,
):
    """Distribute rake shares to referrer chain after each hand.
    Level 1 (direct referrer): 10% of rake -> bonus_balance
    Level 2 (referrer's referrer): 3% of rake -> bonus_balance
    """
    if rake_amount <= 0 or player_user_id <= 0:
        return

    res = await db.execute(
        select(Referral).where(Referral.referred_id == player_user_id)
    )
    ref_l1 = res.scalar_one_or_none()
    if not ref_l1:
        return

    l1_share = round(rake_amount * RAKE_SHARE_L1, 4)
    if l1_share > 0:
        bal_res = await db.execute(select(Balance).where(Balance.user_id == ref_l1.referrer_id))
        bal = bal_res.scalar_one_or_none()
        if bal:
            bal.bonus_balance = float(bal.bonus_balance) + l1_share
            db.add(Transaction(currency=CurrencyType.CHIP, 
                user_id=ref_l1.referrer_id,
                tx_type=TxType.SYNDICATE_RAKE,
                amount=l1_share,
                balance_after=float(bal.amount),
                reference=f"rake_l1_from_{player_user_id}",
            ))

    res2 = await db.execute(
        select(Referral).where(Referral.referred_id == ref_l1.referrer_id)
    )
    ref_l2 = res2.scalar_one_or_none()
    if not ref_l2:
        return

    l2_share = round(rake_amount * RAKE_SHARE_L2, 4)
    if l2_share > 0:
        bal_res2 = await db.execute(select(Balance).where(Balance.user_id == ref_l2.referrer_id))
        bal2 = bal_res2.scalar_one_or_none()
        if bal2:
            bal2.bonus_balance = float(bal2.bonus_balance) + l2_share
            db.add(Transaction(currency=CurrencyType.CHIP, 
                user_id=ref_l2.referrer_id,
                tx_type=TxType.SYNDICATE_RAKE,
                amount=l2_share,
                balance_after=float(bal2.amount),
                reference=f"rake_l2_from_{player_user_id}",
            ))
