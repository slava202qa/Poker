from pydantic_settings import BaseSettings
from functools import lru_cache


class BotSettings(BaseSettings):
    bot_token: str = ""
    webapp_url: str = "https://localhost"
    backend_url: str = "http://backend:8000"
    system_wallet_address: str = ""
    ton_api_url: str = "https://toncenter.com/api/v2"
    ton_api_key: str = ""

    # Exchange rates (fixed)
    rate_ton_to_rr: float = 55.0   # 1 TON = 55 RR
    rate_usdt_to_rr: float = 42.0  # 1 USDT = 42 RR

    # Limits
    min_buy_rr: float = 10.0
    min_sell_rr: float = 10.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_bot_settings() -> BotSettings:
    return BotSettings()
