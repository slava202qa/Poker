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
