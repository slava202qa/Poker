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
                KeyboardButton(text="💰 Купить RR"),
                KeyboardButton(text="💸 Продать RR"),
            ],
            [
                KeyboardButton(text="💎 Баланс"),
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


# ── Buy keyboards ──

def get_buy_currency_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🔷 TON", callback_data="buy_currency:ton"),
            InlineKeyboardButton(text="💵 USDT", callback_data="buy_currency:usdt"),
        ],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")],
    ])


def get_buy_amount_kb(currency: str, rate: float) -> InlineKeyboardMarkup:
    """Preset buy amounts."""
    presets = [
        (rate * 5, 5),
        (rate * 10, 10),
        (rate * 20, 20),
        (rate * 50, 50),
    ]
    symbol = "TON" if currency == "ton" else "USDT"
    rows = []
    for rr, crypto in presets:
        rows.append([InlineKeyboardButton(
            text=f"{rr:,.0f} RR ({crypto} {symbol})",
            callback_data=f"buy_amount:{rr:.0f}:{crypto:.2f}",
        )])
    rows.append([InlineKeyboardButton(text="✏️ Ввести свою сумму RR", callback_data="buy_custom")])
    rows.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ── Sell keyboards ──

def get_sell_currency_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🔷 TON", callback_data="sell_currency:ton"),
            InlineKeyboardButton(text="💵 USDT", callback_data="sell_currency:usdt"),
        ],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")],
    ])


def get_sell_amount_kb(currency: str, rate: float, balance: float) -> InlineKeyboardMarkup:
    symbol = "TON" if currency == "ton" else "USDT"
    rows = []

    presets_rr = [rr for rr in [rate * 5, rate * 10, rate * 20] if rr <= balance]
    for rr in presets_rr:
        crypto = rr / rate
        rows.append([InlineKeyboardButton(
            text=f"{rr:,.0f} RR → {crypto:.2f} {symbol}",
            callback_data=f"sell_amount:{rr:.0f}:{crypto:.4f}",
        )])

    # "Sell all" option
    if balance >= 10:
        crypto_all = balance / rate
        rows.append([InlineKeyboardButton(
            text=f"Всё: {balance:,.0f} RR → {crypto_all:.4f} {symbol}",
            callback_data=f"sell_amount:{balance:.0f}:{crypto_all:.4f}",
        )])

    rows.append([InlineKeyboardButton(text="✏️ Ввести свою сумму RR", callback_data="sell_custom")])
    rows.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def get_confirm_sell_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data="sell_confirm"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="sell_cancel"),
        ],
    ])
