import datetime
import enum
from sqlalchemy import Integer, String, Numeric, DateTime, Enum, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.balance import CurrencyType


class TableStatus(str, enum.Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    PAUSED = "paused"


class PokerType(str, enum.Enum):
    HOLDEM = "holdem"
    OMAHA = "omaha"


class PokerTable(Base):
    __tablename__ = "poker_tables"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    currency: Mapped[CurrencyType] = mapped_column(
        Enum(CurrencyType), default=CurrencyType.CHIP, nullable=False
    )
    poker_type: Mapped[PokerType] = mapped_column(
        Enum(PokerType), default=PokerType.HOLDEM, nullable=False
    )
    max_players: Mapped[int] = mapped_column(Integer, default=6)
    small_blind: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    big_blind: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    min_buy_in: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    max_buy_in: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    action_timer: Mapped[int] = mapped_column(Integer, default=30)  # seconds per turn
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    invite_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    creator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[TableStatus] = mapped_column(Enum(TableStatus), default=TableStatus.WAITING)
    current_players: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TablePlayer(Base):
    __tablename__ = "table_players"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("poker_tables.id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    seat: Mapped[int] = mapped_column(Integer, nullable=False)
    stack: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    is_sitting_out: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
