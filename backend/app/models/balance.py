import datetime
import enum
from sqlalchemy import BigInteger, Numeric, String, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Balance(Base):
    __tablename__ = "balances"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), default=0, nullable=False)
    fun_amount: Mapped[float] = mapped_column(Numeric(18, 4), default=10000, nullable=False)
    fun_last_refill: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="balance")


class CurrencyType(str, enum.Enum):
    CHIP = "chip"
    FUN = "fun"


class TxType(str, enum.Enum):
    DEPOSIT = "deposit"
    WITHDRAW = "withdraw"
    BUY_IN = "buy_in"
    CASH_OUT = "cash_out"
    RAKE = "rake"
    TOURNAMENT_ENTRY = "tournament_entry"
    TOURNAMENT_PRIZE = "tournament_prize"
    BONUS = "bonus"
    FUN_REFILL = "fun_refill"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    currency: Mapped[CurrencyType] = mapped_column(
        Enum(CurrencyType), default=CurrencyType.CHIP, nullable=False
    )
    tx_type: Mapped[TxType] = mapped_column(Enum(TxType), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    balance_after: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ton_tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
