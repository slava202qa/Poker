from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str
    ton_wallet: str | None
    balance: float

    class Config:
        from_attributes = True


@router.post("/login", response_model=UserResponse)
async def login(user: User = Depends(get_current_user)):
    """Authenticate via Telegram initData. Creates user on first login."""
    return UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        ton_wallet=user.ton_wallet,
        balance=float(user.balance.amount) if user.balance else 0,
    )


class WalletConnectRequest(BaseModel):
    wallet_address: str


@router.post("/connect-wallet", response_model=UserResponse)
async def connect_wallet(
    body: WalletConnectRequest,
    user: User = Depends(get_current_user),
):
    """Link TON wallet address to user account."""
    user.ton_wallet = body.wallet_address
    return UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        ton_wallet=user.ton_wallet,
        balance=float(user.balance.amount) if user.balance else 0,
    )
