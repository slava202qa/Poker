from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton,
)
from config import get_bot_settings

ADMIN_IDS = {7157045158}


def get_main_keyboard(user_id: int = 0) -> ReplyKeyboardMarkup:
    settings = get_bot_settings()
    rows = []

    # Main entry — WebApp button
    if settings.webapp_url.startswith("https://"):
        rows.append([KeyboardButton(
            text="♠️ ВХОД В ЗАЛ",
            web_app=WebAppInfo(url=settings.webapp_url),
        )])

    # Admin panel — only for admins
    if user_id in ADMIN_IDS and settings.webapp_url.startswith("https://"):
        rows.append([KeyboardButton(
            text="⚙️ Админ панель",
            web_app=WebAppInfo(url=f"{settings.webapp_url}/admin"),
        )])

    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def get_webapp_button() -> InlineKeyboardMarkup:
    settings = get_bot_settings()
    if settings.webapp_url.startswith("https://"):
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="♠️ Открыть Royal Roll",
                web_app=WebAppInfo(url=settings.webapp_url),
            )
        ]])
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🌐 Открыть", url=settings.webapp_url)
    ]])


def get_admin_button() -> InlineKeyboardMarkup:
    settings = get_bot_settings()
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="⚙️ Открыть админ панель",
            web_app=WebAppInfo(url=f"{settings.webapp_url}/admin"),
        )
    ]])
