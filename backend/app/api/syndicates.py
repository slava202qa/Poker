"""Syndicate (Clan) system API."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.config import get_settings, Settings
from app.models.user import User
from app.models.balance import Balance, Transaction, TxType, CurrencyType
from app.models.clan import Clan, ClanMember, ClanRole, ClanMessage, ClanWeeklyScore

router = APIRouter(prefix="/syndicates", tags=["syndicates"])

CREATION_COST = 500  # RR


# ── Schemas ──────────────────────────────────────────────────────────────────

class SyndicateCreate(BaseModel):
    name: str
    tag: str        # 2-5 chars
    description: str = ""
    icon: str = "♠️"


class SyndicateOut(BaseModel):
    id: int
    name: str
    tag: str
    description: str | None
    icon: str | None
    owner_id: int
    member_count: int
    total_xp: int
    my_role: str | None = None


class MemberOut(BaseModel):
    telegram_id: int
    username: str | None
    first_name: str
    role: str
    contribution_xp: int
    is_online: bool


class MessageOut(BaseModel):
    id: int
    user_id: int
    first_name: str
    username: str | None
    text: str
    created_at: str


class MessageIn(BaseModel):
    text: str


class LeaderboardEntry(BaseModel):
    rank: int
    clan_id: int
    name: str
    tag: str
    icon: str | None
    total_winnings: float
    hands_played: int
    member_count: int


# ── Helpers ──────────────────────────────────────────────────────────────────

def _week_start() -> datetime.datetime:
    now = datetime.datetime.now(datetime.timezone.utc)
    return (now - datetime.timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


async def _get_my_membership(user: User, db: AsyncSession) -> ClanMember | None:
    res = await db.execute(
        select(ClanMember).where(ClanMember.user_id == user.id)
    )
    return res.scalar_one_or_none()


async def _get_clan_or_404(clan_id: int, db: AsyncSession) -> Clan:
    res = await db.execute(select(Clan).where(Clan.id == clan_id, Clan.is_active == True))
    clan = res.scalar_one_or_none()
    if not clan:
        raise HTTPException(404, "Syndicate not found")
    return clan


def _is_online(user: User) -> bool:
    if not user.last_seen:
        return False
    delta = datetime.datetime.now(datetime.timezone.utc) - user.last_seen.replace(
        tzinfo=datetime.timezone.utc
    )
    return delta.total_seconds() < 300


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/my", response_model=SyndicateOut | None)
async def get_my_syndicate(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the syndicate the current user belongs to, or null."""
    membership = await _get_my_membership(user, db)
    if not membership:
        return None
    clan = await _get_clan_or_404(membership.clan_id, db)
    return SyndicateOut(
        id=clan.id, name=clan.name, tag=clan.tag,
        description=clan.description, icon=clan.icon,
        owner_id=clan.owner_id, member_count=clan.member_count,
        total_xp=clan.total_xp, my_role=membership.role.value,
    )


@router.post("/create", response_model=SyndicateOut)
async def create_syndicate(
    body: SyndicateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Must not already be in a clan
    if await _get_my_membership(user, db):
        raise HTTPException(400, "Already in a syndicate. Leave first.")

    # Validate tag
    tag = body.tag.upper().strip()
    if not (2 <= len(tag) <= 5):
        raise HTTPException(400, "Tag must be 2-5 characters")

    # Check name/tag uniqueness
    dup = await db.execute(
        select(Clan).where((Clan.name == body.name) | (Clan.tag == tag))
    )
    if dup.scalar_one_or_none():
        raise HTTPException(409, "Name or tag already taken")

    # Deduct creation cost
    bal_res = await db.execute(select(Balance).where(Balance.user_id == user.id))
    bal = bal_res.scalar_one_or_none()
    if not bal or float(bal.amount) < CREATION_COST:
        raise HTTPException(402, f"Need {CREATION_COST} RR to create a syndicate")

    bal.amount = float(bal.amount) - CREATION_COST
    db.add(Transaction(
        user_id=user.id, currency=CurrencyType.CHIP,
        tx_type=TxType.BONUS, amount=-CREATION_COST,
        balance_after=float(bal.amount),
        reference="syndicate_creation",
    ))

    clan = Clan(
        name=body.name, tag=tag, description=body.description,
        icon=body.icon, owner_id=user.id, creation_cost=CREATION_COST,
        member_count=1,
    )
    db.add(clan)
    await db.flush()

    db.add(ClanMember(clan_id=clan.id, user_id=user.id, role=ClanRole.OWNER))
    await db.flush()

    return SyndicateOut(
        id=clan.id, name=clan.name, tag=clan.tag,
        description=clan.description, icon=clan.icon,
        owner_id=clan.owner_id, member_count=1, total_xp=0,
        my_role="owner",
    )


@router.get("/list", response_model=list[SyndicateOut])
async def list_syndicates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Clan).where(Clan.is_active == True).order_by(desc(Clan.total_xp)).limit(50)
    )
    clans = res.scalars().all()
    my = await _get_my_membership(user, db)
    result = []
    for c in clans:
        role = None
        if my and my.clan_id == c.id:
            role = my.role.value
        result.append(SyndicateOut(
            id=c.id, name=c.name, tag=c.tag, description=c.description,
            icon=c.icon, owner_id=c.owner_id, member_count=c.member_count,
            total_xp=c.total_xp, my_role=role,
        ))
    return result


@router.post("/join/{clan_id}")
async def join_syndicate(
    clan_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if await _get_my_membership(user, db):
        raise HTTPException(400, "Already in a syndicate")
    clan = await _get_clan_or_404(clan_id, db)
    if clan.member_count >= clan.max_members:
        raise HTTPException(400, "Syndicate is full")
    db.add(ClanMember(clan_id=clan.id, user_id=user.id, role=ClanRole.MEMBER))
    clan.member_count += 1
    await db.flush()
    return {"status": "joined"}


@router.post("/leave")
async def leave_syndicate(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _get_my_membership(user, db)
    if not membership:
        raise HTTPException(400, "Not in a syndicate")
    if membership.role == ClanRole.OWNER:
        raise HTTPException(400, "Owner cannot leave. Transfer ownership or disband first.")
    clan_res = await db.execute(select(Clan).where(Clan.id == membership.clan_id))
    clan = clan_res.scalar_one_or_none()
    if clan:
        clan.member_count = max(0, clan.member_count - 1)
    await db.delete(membership)
    await db.flush()
    return {"status": "left"}


@router.get("/{clan_id}/members", response_model=list[MemberOut])
async def get_members(
    clan_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_clan_or_404(clan_id, db)
    res = await db.execute(
        select(ClanMember).where(ClanMember.clan_id == clan_id)
    )
    members = res.scalars().all()
    result = []
    for m in members:
        u_res = await db.execute(select(User).where(User.id == m.user_id))
        u = u_res.scalar_one_or_none()
        if not u:
            continue
        result.append(MemberOut(
            telegram_id=u.telegram_id, username=u.username,
            first_name=u.first_name, role=m.role.value,
            contribution_xp=m.contribution_xp, is_online=_is_online(u),
        ))
    result.sort(key=lambda x: (x.role != "owner", x.role != "officer", not x.is_online))
    return result


# ── Chat ─────────────────────────────────────────────────────────────────────

@router.get("/{clan_id}/chat", response_model=list[MessageOut])
async def get_chat(
    clan_id: int,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Must be a member
    membership = await _get_my_membership(user, db)
    if not membership or membership.clan_id != clan_id:
        raise HTTPException(403, "Not a member of this syndicate")

    res = await db.execute(
        select(ClanMessage).where(ClanMessage.clan_id == clan_id)
        .order_by(desc(ClanMessage.created_at)).limit(limit)
    )
    messages = list(reversed(res.scalars().all()))

    result = []
    for msg in messages:
        u_res = await db.execute(select(User).where(User.id == msg.user_id))
        u = u_res.scalar_one_or_none()
        result.append(MessageOut(
            id=msg.id, user_id=msg.user_id,
            first_name=u.first_name if u else "?",
            username=u.username if u else None,
            text=msg.text,
            created_at=msg.created_at.isoformat(),
        ))
    return result


@router.post("/{clan_id}/chat")
async def send_message(
    clan_id: int,
    body: MessageIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _get_my_membership(user, db)
    if not membership or membership.clan_id != clan_id:
        raise HTTPException(403, "Not a member")
    if not body.text.strip():
        raise HTTPException(400, "Empty message")
    if len(body.text) > 500:
        raise HTTPException(400, "Message too long")

    msg = ClanMessage(clan_id=clan_id, user_id=user.id, text=body.text.strip())
    db.add(msg)
    await db.flush()
    return {"status": "sent", "id": msg.id}


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/leaderboard/weekly", response_model=list[LeaderboardEntry])
async def weekly_leaderboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    week = _week_start()
    res = await db.execute(
        select(ClanWeeklyScore, Clan)
        .join(Clan, Clan.id == ClanWeeklyScore.clan_id)
        .where(ClanWeeklyScore.week_start == week, Clan.is_active == True)
        .order_by(desc(ClanWeeklyScore.total_winnings))
        .limit(20)
    )
    rows = res.all()
    result = []
    for rank, (score, clan) in enumerate(rows, 1):
        result.append(LeaderboardEntry(
            rank=rank, clan_id=clan.id, name=clan.name, tag=clan.tag,
            icon=clan.icon, total_winnings=float(score.total_winnings),
            hands_played=score.hands_played, member_count=clan.member_count,
        ))
    return result
