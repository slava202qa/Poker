import datetime
from sqlalchemy import Integer, String, Numeric, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class HandHistory(Base):
    """One row per completed hand. Winners and cards stored as JSON strings."""
    __tablename__ = "hand_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    table_id: Mapped[int] = mapped_column(Integer, ForeignKey("poker_tables.id", ondelete="SET NULL"), nullable=True, index=True)
    table_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pot: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    rake: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    # JSON: [{"user_id": 1, "amount": 500, "hand_rank": "FLUSH", "cards": [...]}]
    winners_json: Mapped[str] = mapped_column(Text, default="[]")
    # JSON: ["Ah", "Kd", "Qc", "Js", "Th"]
    community_cards_json: Mapped[str] = mapped_column(Text, default="[]")
    poker_type: Mapped[str] = mapped_column(String(16), default="HOLDEM")
    player_count: Mapped[int] = mapped_column(Integer, default=0)
    finished_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
