"""Battle Pass API: season info, user progress, XP grant, reward claim."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.battlepass import BattlePassSeason, BattlePassLevel, UserBattlePass
from app.models.balance import Balance, Transaction, TxType, CurrencyType

router = APIRouter(prefix="/battlepass", tags=["battlepass"])

XP_PER_HAND = 15       # XP awarded per hand played
XP_WIN_BONUS = 25      # extra XP for winning a hand


# ── Schemas ───────────────────────────────────────────────────────────────────

class LevelReward(BaseModel):
    level: int
    free_reward: str | None
    free_reward_icon: str | None
    free_reward_amount: int
    claimed: bool


class SeasonProgress(BaseModel):
    season_id: int
    season_name: str
    total_levels: int
    xp_per_level: int
    ends_at: str
    current_level: int
    current_xp: int
    xp_to_next: int
    total_xp_earned: int
    progress_pct: float
    levels: list[LevelReward]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_create_progress(
    user_id: int, season: BattlePassSeason, db: AsyncSession
) -> UserBattlePass:
    result = await db.execute(
        select(UserBattlePass).where(
            UserBattlePass.user_id == user_id,
            UserBattlePass.season_id == season.id,
        )
    )
    ubp = result.scalar_one_or_none()
    if ubp is None:
        ubp = UserBattlePass(user_id=user_id, season_id=season.id)
        db.add(ubp)
        await db.flush()
    return ubp


async def _active_season(db: AsyncSession) -> BattlePassSeason | None:
    now = datetime.datetime.now(datetime.timezone.utc)
    result = await db.execute(
        select(BattlePassSeason).where(
            BattlePassSeason.is_active == True,
            BattlePassSeason.starts_at <= now,
            BattlePassSeason.ends_at >= now,
        ).order_by(BattlePassSeason.id.desc())
    )
    return result.scalar_one_or_none()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/season", response_model=SeasonProgress)
async def get_season(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    season = await _active_season(db)
    if not season:
        raise HTTPException(status_code=404, detail="No active season")

    ubp = await _get_or_create_progress(user.id, season, db)
    await db.commit()

    levels_result = await db.execute(
        select(BattlePassLevel)
        .where(BattlePassLevel.season_id == season.id)
        .order_by(BattlePassLevel.level)
    )
    levels = levels_result.scalars().all()
    claimed_set = set(int(x) for x in ubp.claimed_levels.split(",") if x.strip())

    xp_to_next = season.xp_per_level - ubp.current_xp
    progress_pct = (ubp.current_xp / season.xp_per_level * 100) if season.xp_per_level else 0

    return SeasonProgress(
        season_id=season.id,
        season_name=season.name,
        total_levels=season.total_levels,
        xp_per_level=season.xp_per_level,
        ends_at=season.ends_at.isoformat(),
        current_level=ubp.current_level,
        current_xp=ubp.current_xp,
        xp_to_next=xp_to_next,
        total_xp_earned=ubp.total_xp_earned,
        progress_pct=round(progress_pct, 1),
        levels=[
            LevelReward(
                level=lv.level,
                free_reward=lv.free_reward,
                free_reward_icon=lv.free_reward_icon,
                free_reward_amount=lv.free_reward_amount,
                claimed=lv.level in claimed_set,
            )
            for lv in levels
        ],
    )


@router.post("/claim/{level}")
async def claim_reward(
    level: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Claim the free reward for a completed level."""
    season = await _active_season(db)
    if not season:
        raise HTTPException(status_code=404, detail="No active season")

    ubp = await _get_or_create_progress(user.id, season, db)

    if level > ubp.current_level:
        raise HTTPException(status_code=400, detail="Level not reached yet")

    claimed_set = set(int(x) for x in ubp.claimed_levels.split(",") if x.strip())
    if level in claimed_set:
        raise HTTPException(status_code=409, detail="Already claimed")

    # Find reward
    lv_result = await db.execute(
        select(BattlePassLevel).where(
            BattlePassLevel.season_id == season.id,
            BattlePassLevel.level == level,
        )
    )
    lv = lv_result.scalar_one_or_none()
    if not lv:
        raise HTTPException(status_code=404, detail="Level reward not found")

    # Grant reward
    reward_granted = None
    if lv.free_reward_amount > 0:
        bal_result = await db.execute(select(Balance).where(Balance.user_id == user.id))
        bal = bal_result.scalar_one_or_none()
        if bal:
            bal.amount = float(bal.amount) + lv.free_reward_amount
            db.add(Transaction(
                user_id=user.id,
                currency=CurrencyType.CHIP,
                tx_type=TxType.BONUS,
                amount=lv.free_reward_amount,
                balance_after=float(bal.amount),
                reference=f"battlepass:s{season.id}:lv{level}",
            ))
            reward_granted = f"+{lv.free_reward_amount} RR"

    # Mark claimed
    claimed_set.add(level)
    ubp.claimed_levels = ",".join(str(x) for x in sorted(claimed_set))
    await db.commit()

    return {
        "status": "claimed",
        "level": level,
        "reward": lv.free_reward,
        "reward_granted": reward_granted,
    }


# ── Internal: grant XP after hand ────────────────────────────────────────────

async def grant_xp(user_id: int, xp: int, db: AsyncSession):
    """Add XP to user's battle pass progress. Called from game_manager."""
    season = await _active_season(db)
    if not season:
        return

    ubp = await _get_or_create_progress(user_id, season, db)
    ubp.current_xp += xp
    ubp.total_xp_earned += xp

    # Level up loop
    while ubp.current_xp >= season.xp_per_level and ubp.current_level < season.total_levels:
        ubp.current_xp -= season.xp_per_level
        ubp.current_level += 1

    await db.flush()


async def seed_season_1(db: AsyncSession):
    """Seed Season 1 if it doesn't exist yet."""
    existing = await db.execute(select(BattlePassSeason).where(BattlePassSeason.id == 1))
    if existing.scalar_one_or_none():
        return

    now = datetime.datetime.now(datetime.timezone.utc)
    season = BattlePassSeason(
        id=1,
        name="Сезон 1",
        total_levels=50,
        xp_per_level=500,
        starts_at=now,
        ends_at=now + datetime.timedelta(days=90),
        is_active=True,
    )
    db.add(season)
    await db.flush()

    # Define rewards for all 50 levels
    rewards = []
    for lv in range(1, 51):
        if lv % 10 == 0:
            # Big milestone: chips
            rewards.append(BattlePassLevel(
                season_id=1, level=lv,
                free_reward=f"Фишки ×{lv * 10}",
                free_reward_icon="💰",
                free_reward_amount=lv * 10,
            ))
        elif lv % 5 == 0:
            # Medium: smaller chips
            rewards.append(BattlePassLevel(
                season_id=1, level=lv,
                free_reward="Фишки ×50",
                free_reward_icon="🪙",
                free_reward_amount=50,
            ))
        else:
            # Regular: XP boost label (no chip reward)
            rewards.append(BattlePassLevel(
                season_id=1, level=lv,
                free_reward="Бонус XP",
                free_reward_icon="⚡",
                free_reward_amount=0,
            ))

    for r in rewards:
        db.add(r)

    await db.commit()
