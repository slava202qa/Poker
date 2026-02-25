import datetime
import enum
from sqlalchemy import Integer, String, Numeric, DateTime, Enum, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TableStatus(str, enum.Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    PAUSED = "paused"


class PokerTable(Base):
    __tablename__ = "poker_tables"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, default=9)
    small_blind: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    big_blind: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    min_buy_in: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    max_buy_in: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
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
