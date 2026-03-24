"""Shop items, user inventory, and player statistics models."""
import datetime
import enum
from sqlalchemy import Integer, String, Numeric, DateTime, Enum, ForeignKey, Boolean, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ItemType(str, enum.Enum):
    CARD_SKIN = "card_skin"
    AVATAR_FRAME = "avatar_frame"
    EMOTE = "emote"
    VIP = "vip"


class ItemRarity(str, enum.Enum):
    COMMON = "common"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"


class ShopItem(Base):
    """Catalogue of purchasable cosmetic items."""
    __tablename__ = "shop_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    item_type: Mapped[ItemType] = mapped_column(Enum(ItemType), nullable=False)
    rarity: Mapped[ItemRarity] = mapped_column(Enum(ItemRarity), default=ItemRarity.COMMON)
    price: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    icon: Mapped[str] = mapped_column(String(16), nullable=True)        # emoji fallback
    image_url: Mapped[str] = mapped_column(String(512), nullable=True)  # uploaded image
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # For VIP: duration in days (0 = permanent)
    vip_days: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserInventory(Base):
    """Items owned by a user."""
    __tablename__ = "user_inventory"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("shop_items.id"), nullable=False)
    is_equipped: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    purchased_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlayerStats(Base):
    """Aggregated per-user game statistics, updated after each hand."""
    __tablename__ = "player_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)

    hands_played: Mapped[int] = mapped_column(Integer, default=0)
    hands_won: Mapped[int] = mapped_column(Integer, default=0)
    # Hands won without reaching showdown (opponent folded)
    hands_won_no_showdown: Mapped[int] = mapped_column(Integer, default=0)
    all_ins_won: Mapped[int] = mapped_column(Integer, default=0)
    tournaments_played: Mapped[int] = mapped_column(Integer, default=0)
    tournaments_won: Mapped[int] = mapped_column(Integer, default=0)
    biggest_pot_won: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    total_chips_won: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
    # Best hand ever seen (e.g. "Royal Flush")
    best_hand: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # XP for levelling system
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    # Consecutive login days
    login_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_login_date: Mapped[datetime.date | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
