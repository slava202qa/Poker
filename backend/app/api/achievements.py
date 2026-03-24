"""Achievements API and progress checker called after each hand."""
import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.achievement import Achievement, UserAchievement
from app.models.shop import PlayerStats

router = APIRouter(prefix="/achievements", tags=["achievements"])


class AchievementOut(BaseModel):
    id: int
    key: str
    name: str
    description: str | None
    icon: str | None
    rarity: str
    target: int
    xp_reward: int
    progress: int
    unlocked: bool
    unlocked_at: str | None


@router.get("/", response_model=list[AchievementOut])
async def list_achievements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all achievements with per-user progress."""
    all_ach = (await db.execute(select(Achievement))).scalars().all()

    user_ach_result = await db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user.id)
    )
    user_map: dict[int, UserAchievement] = {
        row.achievement_id: row for row in user_ach_result.scalars().all()
    }

    out = []
    for ach in all_ach:
        ua = user_map.get(ach.id)
        out.append(AchievementOut(
            id=ach.id,
            key=ach.key,
            name=ach.name,
            description=ach.description,
            icon=ach.icon,
            rarity=ach.rarity,
            target=ach.target,
            xp_reward=ach.xp_reward,
            progress=ua.progress if ua else 0,
            unlocked=ua.unlocked if ua else False,
            unlocked_at=ua.unlocked_at.isoformat() if (ua and ua.unlocked_at) else None,
        ))
    return out


# ── Internal helper called from game_manager after each hand ──────────────────

async def check_and_award(user_id: int, db: AsyncSession) -> list[str]:
    """
    Re-evaluate all achievement conditions for a user based on PlayerStats.
    Returns list of newly unlocked achievement keys.
    """
    stats_result = await db.execute(
        select(PlayerStats).where(PlayerStats.user_id == user_id)
    )
    stats = stats_result.scalar_one_or_none()
    if not stats:
        return []

    all_ach = (await db.execute(select(Achievement))).scalars().all()
    user_ach_result = await db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_id)
    )
    user_map: dict[int, UserAchievement] = {
        row.achievement_id: row for row in user_ach_result.scalars().all()
    }

    newly_unlocked: list[str] = []
    now = datetime.datetime.now(datetime.timezone.utc)

    for ach in all_ach:
        ua = user_map.get(ach.id)
        if ua and ua.unlocked:
            continue  # already done

        # Map achievement key → current progress value
        progress = _get_progress(ach.key, stats)

        if ua is None:
            ua = UserAchievement(
                user_id=user_id,
                achievement_id=ach.id,
                progress=progress,
                unlocked=False,
            )
            db.add(ua)
        else:
            ua.progress = progress

        if progress >= ach.target:
            ua.unlocked = True
            ua.unlocked_at = now
            newly_unlocked.append(ach.key)
            # Award XP
            stats.xp = (stats.xp or 0) + ach.xp_reward
            stats.level = _calc_level(stats.xp)

    if newly_unlocked:
        await db.flush()

    return newly_unlocked


def _get_progress(key: str, stats: PlayerStats) -> int:
    """Map achievement key to the relevant stat counter."""
    mapping = {
        "first_hand":     stats.hands_played,
        "first_win":      stats.hands_won,
        "hands_10":       stats.hands_played,
        "hands_100":      stats.hands_played,
        "hands_1000":     stats.hands_played,
        "royal_flush":    1 if stats.best_hand == "Royal Flush" else 0,
        "bluff_master":   stats.hands_won_no_showdown,
        "big_pot":        1 if float(stats.biggest_pot_won or 0) >= 10000 else 0,
        "tournament_win": stats.tournaments_won,
        "all_in_win":     stats.all_ins_won,
        # streak_5 and login_* are updated externally
        "streak_5":       0,
        "login_7":        stats.login_streak,
        "login_30":       stats.login_streak,
    }
    return mapping.get(key, 0)


def _calc_level(xp: int) -> int:
    """Simple level formula: level = floor(sqrt(xp / 100)) + 1."""
    import math
    return max(1, int(math.sqrt(max(0, xp) / 100)) + 1)
