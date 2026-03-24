"""Shop API: catalogue, purchase, inventory, equip."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType, CurrencyType
from app.models.shop import ShopItem, UserInventory, ItemType

router = APIRouter(prefix="/shop", tags=["shop"])


# ── Response schemas ──────────────────────────────────────────────────────────

class ShopItemOut(BaseModel):
    id: int
    item_key: str
    name: str
    description: str | None
    item_type: str
    rarity: str
    price: float
    icon: str | None
    vip_days: int
    owned: bool = False
    equipped: bool = False
    expires_at: str | None = None

    class Config:
        from_attributes = True


class PurchaseRequest(BaseModel):
    item_key: str


class EquipRequest(BaseModel):
    item_key: str


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_inventory_map(user_id: int, db: AsyncSession) -> dict[int, UserInventory]:
    """Return {item_id: UserInventory} for a user."""
    result = await db.execute(
        select(UserInventory).where(UserInventory.user_id == user_id)
    )
    return {row.item_id: row for row in result.scalars().all()}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/items", response_model=list[ShopItemOut])
async def list_items(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all active shop items with ownership flags."""
    items_result = await db.execute(
        select(ShopItem).where(ShopItem.is_active == True).order_by(ShopItem.id)
    )
    items = items_result.scalars().all()

    inv = await _get_inventory_map(user.id, db)
    now = datetime.datetime.now(datetime.timezone.utc)

    out = []
    for item in items:
        inv_row = inv.get(item.id)
        # VIP items expire; treat as not owned if expired
        owned = inv_row is not None
        if owned and inv_row.expires_at and inv_row.expires_at < now:
            owned = False

        out.append(ShopItemOut(
            id=item.id,
            item_key=item.item_key,
            name=item.name,
            description=item.description,
            item_type=item.item_type.value,
            rarity=item.rarity.value,
            price=float(item.price),
            icon=item.icon,
            vip_days=item.vip_days,
            owned=owned,
            equipped=inv_row.is_equipped if inv_row else False,
            expires_at=inv_row.expires_at.isoformat() if (inv_row and inv_row.expires_at) else None,
        ))
    return out


@router.post("/buy", response_model=dict)
async def buy_item(
    body: PurchaseRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Purchase a shop item. Deducts CHIP from balance, adds to inventory."""
    # Fetch item
    item_result = await db.execute(
        select(ShopItem).where(ShopItem.item_key == body.item_key, ShopItem.is_active == True)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check if already owned (non-VIP items are permanent)
    inv = await _get_inventory_map(user.id, db)
    now = datetime.datetime.now(datetime.timezone.utc)

    if item.id in inv:
        existing = inv[item.id]
        # Allow re-purchase of VIP if expired
        if item.item_type != ItemType.VIP or (existing.expires_at and existing.expires_at > now):
            raise HTTPException(status_code=409, detail="Already owned")

    # Free items (price == 0) skip balance check
    if float(item.price) > 0:
        balance_result = await db.execute(
            select(Balance).where(Balance.user_id == user.id)
        )
        balance = balance_result.scalar_one_or_none()
        if not balance or float(balance.amount) < float(item.price):
            raise HTTPException(status_code=402, detail="Insufficient balance")

        balance.amount = float(balance.amount) - float(item.price)
        balance_after = float(balance.amount)

        tx = Transaction(
            user_id=user.id,
            currency=CurrencyType.CHIP,
            tx_type=TxType.SHOP_PURCHASE,
            amount=-float(item.price),
            balance_after=balance_after,
            reference=f"shop:{item.item_key}",
        )
        db.add(tx)

    # Add to inventory (or update expiry for VIP)
    if item.id in inv:
        existing = inv[item.id]
        if item.vip_days > 0:
            base = max(now, existing.expires_at or now)
            existing.expires_at = base + datetime.timedelta(days=item.vip_days)
    else:
        expires_at = None
        if item.vip_days > 0:
            expires_at = now + datetime.timedelta(days=item.vip_days)
        inv_row = UserInventory(
            user_id=user.id,
            item_id=item.id,
            is_equipped=False,
            expires_at=expires_at,
        )
        db.add(inv_row)

    await db.commit()
    return {"status": "ok", "item_key": item.item_key}


@router.post("/equip", response_model=dict)
async def equip_item(
    body: EquipRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Equip an owned item. Unequips other items of the same type."""
    item_result = await db.execute(
        select(ShopItem).where(ShopItem.item_key == body.item_key)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    inv_result = await db.execute(
        select(UserInventory).where(
            UserInventory.user_id == user.id,
            UserInventory.item_id == item.id,
        )
    )
    inv_row = inv_result.scalar_one_or_none()
    if not inv_row:
        raise HTTPException(status_code=403, detail="Item not owned")

    # Unequip all items of the same type
    same_type_result = await db.execute(
        select(UserInventory, ShopItem)
        .join(ShopItem, UserInventory.item_id == ShopItem.id)
        .where(
            UserInventory.user_id == user.id,
            ShopItem.item_type == item.item_type,
            UserInventory.is_equipped == True,
        )
    )
    for row_inv, _ in same_type_result.all():
        row_inv.is_equipped = False

    inv_row.is_equipped = True
    await db.commit()
    return {"status": "ok", "equipped": item.item_key}


@router.get("/inventory", response_model=list[ShopItemOut])
async def get_inventory(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all items owned by the current user."""
    result = await db.execute(
        select(UserInventory, ShopItem)
        .join(ShopItem, UserInventory.item_id == ShopItem.id)
        .where(UserInventory.user_id == user.id)
    )
    now = datetime.datetime.now(datetime.timezone.utc)
    out = []
    for inv_row, item in result.all():
        owned = True
        if inv_row.expires_at and inv_row.expires_at < now:
            owned = False
        out.append(ShopItemOut(
            id=item.id,
            item_key=item.item_key,
            name=item.name,
            description=item.description,
            item_type=item.item_type.value,
            rarity=item.rarity.value,
            price=float(item.price),
            icon=item.icon,
            vip_days=item.vip_days,
            owned=owned,
            equipped=inv_row.is_equipped,
            expires_at=inv_row.expires_at.isoformat() if inv_row.expires_at else None,
        ))
    return out
