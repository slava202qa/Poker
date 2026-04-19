"""VIP subscription system."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/vip", tags=["vip"])

VIP_PLANS = {
    "silver":   {"days": 7,   "price_usd": 5,  "rake_discount": 0.0, "ref_bonus": 0.0},
    "gold":     {"days": 30,  "price_usd": 15, "rake_discount": 0.02, "ref_bonus": 0.0},
    "platinum": {"days": 365, "price_usd": 99, "rake_discount": 0.03, "ref_bonus": 0.05},
}


@router.get("/plans")
async def get_vip_plans():
    return VIP_PLANS


@router.get("/status")
async def get_vip_status(user: User = Depends(get_current_user)):
    now = datetime.datetime.now(datetime.timezone.utc)
    active = (
        user.vip_status != "none"
        and user.vip_expires_at is not None
        and user.vip_expires_at > now
    )
    return {
        "vip_status": user.vip_status if active else "none",
        "vip_expires_at": user.vip_expires_at.isoformat() if user.vip_expires_at else None,
        "active": active,
        "plan": VIP_PLANS.get(user.vip_status) if active else None,
    }


class AdminGrantVip(BaseModel):
    user_id: int
    plan: str
    days: int | None = None


@router.post("/admin/grant")
async def admin_grant_vip(
    body: AdminGrantVip,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    from app.api.deps import require_admin
    from app.config import get_settings
    if admin.telegram_id not in get_settings().admin_id_list:
        raise HTTPException(403, "Forbidden")
    if body.plan not in VIP_PLANS:
        raise HTTPException(400, f"Unknown plan: {body.plan}")
    target = await db.get(User, body.user_id)
    if not target:
        raise HTTPException(404, "User not found")
    days = body.days or VIP_PLANS[body.plan]["days"]
    now = datetime.datetime.now(datetime.timezone.utc)
    # Extend if already active
    base = max(now, target.vip_expires_at or now)
    target.vip_status = body.plan
    target.vip_expires_at = base + datetime.timedelta(days=days)
    await db.commit()
    return {"status": "granted", "vip_status": target.vip_status, "expires_at": target.vip_expires_at.isoformat()}


@router.post("/admin/revoke/{user_id}")
async def admin_revoke_vip(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    from app.config import get_settings
    if admin.telegram_id not in get_settings().admin_id_list:
        raise HTTPException(403, "Forbidden")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.vip_status = "none"
    target.vip_expires_at = None
    await db.commit()
    return {"status": "revoked"}
