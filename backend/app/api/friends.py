"""Friends system API."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.friendship import Friendship

router = APIRouter(prefix="/friends", tags=["friends"])

ONLINE_THRESHOLD_MINUTES = 5


def _is_online(user: User) -> bool:
    if not user.last_seen:
        return False
    delta = datetime.datetime.now(datetime.timezone.utc) - user.last_seen.replace(
        tzinfo=datetime.timezone.utc
    )
    return delta.total_seconds() < ONLINE_THRESHOLD_MINUTES * 60


class UserSearchResult(BaseModel):
    telegram_id: int
    username: str | None
    first_name: str
    is_online: bool


class FriendOut(BaseModel):
    friendship_id: int
    telegram_id: int
    username: str | None
    first_name: str
    is_online: bool
    status: str   # accepted | pending | incoming


class FriendRequestOut(BaseModel):
    friendship_id: int
    telegram_id: int
    username: str | None
    first_name: str


# ── Search ──────────────────────────────────────────────────────────────────

@router.get("/search", response_model=list[UserSearchResult])
async def search_users(
    q: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search by telegram_id (numeric) or username."""
    if not q or len(q) < 2:
        return []

    # Try numeric ID first
    try:
        tg_id = int(q)
        res = await db.execute(select(User).where(User.telegram_id == tg_id))
        found = res.scalars().all()
    except ValueError:
        res = await db.execute(
            select(User).where(User.username.ilike(f"%{q}%")).limit(10)
        )
        found = res.scalars().all()

    return [
        UserSearchResult(
            telegram_id=u.telegram_id,
            username=u.username,
            first_name=u.first_name,
            is_online=_is_online(u),
        )
        for u in found
        if u.id != user.id
    ]


# ── Friend list ──────────────────────────────────────────────────────────────

@router.get("/list", response_model=list[FriendOut])
async def get_friends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Friendship).where(
            or_(
                Friendship.requester_id == user.id,
                Friendship.addressee_id == user.id,
            )
        )
    )
    friendships = res.scalars().all()

    result = []
    for f in friendships:
        other_id = f.addressee_id if f.requester_id == user.id else f.requester_id
        u_res = await db.execute(select(User).where(User.id == other_id))
        other = u_res.scalar_one_or_none()
        if not other:
            continue

        if f.status == "accepted":
            status = "accepted"
        elif f.requester_id == user.id and f.status == "pending":
            status = "pending"
        elif f.addressee_id == user.id and f.status == "pending":
            status = "incoming"
        else:
            continue

        result.append(FriendOut(
            friendship_id=f.id,
            telegram_id=other.telegram_id,
            username=other.username,
            first_name=other.first_name,
            is_online=_is_online(other),
            status=status,
        ))

    # Sort: online first, then by name
    result.sort(key=lambda x: (not x.is_online, x.first_name))
    return result


# ── Send request ─────────────────────────────────────────────────────────────

@router.post("/request/{target_telegram_id}")
async def send_friend_request(
    target_telegram_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_telegram_id == user.telegram_id:
        raise HTTPException(400, "Cannot add yourself")

    target_res = await db.execute(select(User).where(User.telegram_id == target_telegram_id))
    target = target_res.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    # Check existing
    existing = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == target.id),
                and_(Friendship.requester_id == target.id, Friendship.addressee_id == user.id),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Request already exists")

    f = Friendship(requester_id=user.id, addressee_id=target.id, status="pending")
    db.add(f)
    await db.flush()
    return {"status": "sent", "friendship_id": f.id}


# ── Accept / decline ─────────────────────────────────────────────────────────

@router.post("/accept/{friendship_id}")
async def accept_request(
    friendship_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Friendship).where(Friendship.id == friendship_id))
    f = res.scalar_one_or_none()
    if not f or f.addressee_id != user.id:
        raise HTTPException(404, "Request not found")
    f.status = "accepted"
    await db.flush()
    return {"status": "accepted"}


@router.post("/decline/{friendship_id}")
async def decline_request(
    friendship_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Friendship).where(Friendship.id == friendship_id))
    f = res.scalar_one_or_none()
    if not f or f.addressee_id != user.id:
        raise HTTPException(404, "Request not found")
    await db.delete(f)
    await db.flush()
    return {"status": "declined"}


@router.delete("/remove/{target_telegram_id}")
async def remove_friend(
    target_telegram_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_res = await db.execute(select(User).where(User.telegram_id == target_telegram_id))
    target = target_res.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    res = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == target.id),
                and_(Friendship.requester_id == target.id, Friendship.addressee_id == user.id),
            )
        )
    )
    f = res.scalar_one_or_none()
    if f:
        await db.delete(f)
        await db.flush()
    return {"status": "removed"}


# ── Invite to table ───────────────────────────────────────────────────────────

class InviteOut(BaseModel):
    invite_url: str
    text: str


@router.get("/invite-to-table/{target_telegram_id}/{table_id}", response_model=InviteOut)
async def invite_to_table(
    target_telegram_id: int,
    table_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns a Telegram share URL to invite a friend to a specific table."""
    from app.models.table import PokerTable
    tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == table_id))
    tbl = tbl_res.scalar_one_or_none()
    if not tbl:
        raise HTTPException(404, "Table not found")

    invite_url = f"https://royalroll.space/tables/{table_id}"
    sender_name = user.first_name or user.username or "Друг"
    text = f"🃏 {sender_name} приглашает тебя за стол «{tbl.name}» в Royal Roll Club!\n{invite_url}"

    tg_share = f"https://t.me/share/url?url={invite_url}&text={text}"
    return InviteOut(invite_url=tg_share, text=text)
