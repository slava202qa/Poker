from pydantic_settings import BaseSettings
from functools import lru_cache


class BotSettings(BaseSettings):
    bot_token: str = ""
    webapp_url: str = "https://localhost"
    backend_url: str = "http://backend:8000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_bot_settings() -> BotSettings:
    return BotSettings()
