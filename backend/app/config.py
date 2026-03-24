from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Telegram
    bot_token: str = ""
    webapp_url: str = "https://localhost"

    # Database
    database_url: str = "postgresql+asyncpg://poker:poker@db:5432/poker"
    redis_url: str = "redis://redis:6379/0"

    # TON
    ton_api_url: str = "https://toncenter.com/api/v2"
    ton_api_key: str = ""
    jetton_master_address: str = ""
    system_wallet_address: str = ""
    ton_mnemonics: str = ""

    # App
    secret_key: str = "change-me"
    rake_percent: float = 3.0
    debug: bool = False

    # Exchange rates — RR per 1 unit of crypto
    # Inverse: 1 RR = rate_usdt_per_rr USDT, 1 RR = rate_ton_per_rr TON
    rate_usdt_per_rr: float = 0.0227   # 1 RR = 0.0227 USDT  → 1 USDT ≈ 44 RR
    rate_ton_per_rr: float  = 0.01724  # 1 RR = 0.01724 TON  → 1 TON  ≈ 58 RR

    # Auto-pay threshold in USD — below this, pay automatically; above, manual review
    auto_pay_usd_limit: float = 100.0

    # Admin — comma-separated Telegram IDs
    admin_ids: str = ""

    @property
    def admin_id_list(self) -> list[int]:
        if not self.admin_ids:
            return []
        return [int(x.strip()) for x in self.admin_ids.split(",") if x.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
