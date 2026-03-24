"""Clan system models: clans, membership, and clan leaderboard."""
import datetime
import enum
from sqlalchemy import Integer, String, Numeric, DateTime, Enum, ForeignKey, Boolean, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ClanRole(str, enum.Enum):
    OWNER = "owner"
    OFFICER = "officer"
    MEMBER = "member"


class Clan(Base):
    __tablename__ = "clans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    tag: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(16), nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Creation cost in CHIP
    creation_cost: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    # XP multiplier for members (e.g. 1.1 = +10% XP)
    xp_multiplier: Mapped[float] = mapped_column(Numeric(4, 2), default=1.0)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    member_count: Mapped[int] = mapped_column(Integer, default=1)
    max_members: Mapped[int] = mapped_column(Integer, default=50)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ClanMember(Base):
    __tablename__ = "clan_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    clan_id: Mapped[int] = mapped_column(ForeignKey("clans.id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    role: Mapped[ClanRole] = mapped_column(Enum(ClanRole), default=ClanRole.MEMBER)
    contribution_xp: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
