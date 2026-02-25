from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton,
)
from config import get_bot_settings


def get_main_keyboard() -> ReplyKeyboardMarkup:
    settings = get_bot_settings()
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(
                text="🎮 Играть",
                web_app=WebAppInfo(url=settings.webapp_url),
            )],
            [
                KeyboardButton(text="💰 Баланс"),
                KeyboardButton(text="👤 Профиль"),
            ],
        ],
        resize_keyboard=True,
    )


def get_webapp_button() -> InlineKeyboardMarkup:
    settings = get_bot_settings()
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🃏 Открыть Poker",
            web_app=WebAppInfo(url=settings.webapp_url),
        )],
    ])
