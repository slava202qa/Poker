import datetime
from sqlalchemy import Integer, ForeignKey, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Friendship(Base):
    """Bidirectional friend request / friendship record."""
    __tablename__ = "friendships"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    addressee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # pending | accepted | declined
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])
    addressee: Mapped["User"] = relationship(foreign_keys=[addressee_id])
