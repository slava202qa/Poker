"""Battle Pass season model and per-user progress."""
import datetime
from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey, Boolean, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BattlePassSeason(Base):
    """A season definition (e.g. Season 1)."""
    __tablename__ = "battlepass_seasons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # Total levels in this season
    total_levels: Mapped[int] = mapped_column(Integer, default=50)
    # XP required per level (flat)
    xp_per_level: Mapped[int] = mapped_column(Integer, default=500)
    starts_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BattlePassLevel(Base):
    """Reward definition for each level of a season."""
    __tablename__ = "battlepass_levels"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("battlepass_seasons.id"), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    # free reward (everyone gets this)
    free_reward: Mapped[str | None] = mapped_column(String(128), nullable=True)
    free_reward_icon: Mapped[str | None] = mapped_column(String(16), nullable=True)
    free_reward_amount: Mapped[int] = mapped_column(Integer, default=0)
    # premium reward (VIP only — reserved for future)
    premium_reward: Mapped[str | None] = mapped_column(String(128), nullable=True)
    premium_reward_icon: Mapped[str | None] = mapped_column(String(16), nullable=True)
    premium_reward_amount: Mapped[int] = mapped_column(Integer, default=0)


class UserBattlePass(Base):
    """Per-user progress in the current season."""
    __tablename__ = "user_battlepass"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("battlepass_seasons.id"), nullable=False)
    current_level: Mapped[int] = mapped_column(Integer, default=1)
    current_xp: Mapped[int] = mapped_column(Integer, default=0)
    total_xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    # Comma-separated list of claimed level numbers
    claimed_levels: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
