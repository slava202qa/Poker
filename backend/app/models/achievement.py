"""Achievement definitions and per-user progress tracking."""
import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Achievement(Base):
    """Master list of all achievements (seeded once)."""
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(16), nullable=True)
    # bronze / silver / gold / diamond
    rarity: Mapped[str] = mapped_column(String(16), default="bronze")
    # Target value to unlock (e.g. 100 for "play 100 hands")
    target: Mapped[int] = mapped_column(Integer, default=1)
    # XP reward on unlock
    xp_reward: Mapped[int] = mapped_column(Integer, default=50)


class UserAchievement(Base):
    """Per-user achievement progress and unlock state."""
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    achievement_id: Mapped[int] = mapped_column(
        ForeignKey("achievements.id"), nullable=False
    )
    progress: Mapped[int] = mapped_column(Integer, default=0)
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    unlocked_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
