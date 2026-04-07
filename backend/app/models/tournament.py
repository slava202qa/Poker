import datetime
import enum
from sqlalchemy import Integer, String, Numeric, DateTime, Enum, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TournamentStatus(str, enum.Enum):
    REGISTERING = "registering"
    RUNNING = "running"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class TournamentType(str, enum.Enum):
    FREEZEOUT = "freezeout"
    REENTRY = "reentry"
    PKO = "pko"


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    buy_in: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    fee: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    starting_stack: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, default=100)
    min_players: Mapped[int] = mapped_column(Integer, default=2)
    current_players: Mapped[int] = mapped_column(Integer, default=0)
    prize_pool: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    guaranteed_prize: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    tournament_type: Mapped[TournamentType] = mapped_column(
        Enum(TournamentType), default=TournamentType.FREEZEOUT, nullable=False
    )
    seats_per_table: Mapped[int] = mapped_column(Integer, default=6)
    blind_level_minutes: Mapped[int] = mapped_column(Integer, default=10)
    late_reg_levels: Mapped[int] = mapped_column(Integer, default=3)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[TournamentStatus] = mapped_column(
        Enum(TournamentStatus), default=TournamentStatus.REGISTERING
    )
    starts_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TournamentPlayer(Base):
    __tablename__ = "tournament_players"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    finish_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prize_won: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    # In-tournament chip stack (separate from cash balance)
    tournament_stack: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    is_eliminated: Mapped[bool] = mapped_column(Boolean, default=False)
    # Current table/seat assignment during the tournament
    table_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seat: Mapped[int | None] = mapped_column(Integer, nullable=True)
    registered_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
