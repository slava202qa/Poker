import datetime
from sqlalchemy import BigInteger, Integer, Boolean, String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Referral(Base):
    """Tracks referral relationships and bonus state."""
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    referrer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    referred_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)

    # Bonus to referrer — paid after referred user's first deposit
    referrer_bonus: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    referrer_bonus_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Welcome bonus to referred user — paid immediately on registration
    welcome_bonus: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    welcome_bonus_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # +5% first deposit bonus for referred user — paid once on first deposit
    first_deposit_bonus_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Anti-fraud: store IP hash at registration time
    referred_ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    referrer: Mapped["User"] = relationship(foreign_keys=[referrer_id])
    referred: Mapped["User"] = relationship(foreign_keys=[referred_id])
