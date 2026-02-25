import httpx
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import CommandStart, Command
from keyboards import get_main_keyboard, get_webapp_button
from config import get_bot_settings

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        "♠️ <b>Poker Platform</b>\n\n"
        "Добро пожаловать в Telegram Poker!\n"
        "Играй в Texas Hold'em на CHIP токенах.\n\n"
        "Нажми <b>🎮 Играть</b> чтобы начать.",
        parse_mode="HTML",
        reply_markup=get_main_keyboard(),
    )


@router.message(Command("balance"))
@router.message(F.text == "💰 Баланс")
async def cmd_balance(message: Message):
    settings = get_bot_settings()
    try:
        async with httpx.AsyncClient() as client:
            # In production, we'd generate proper initData
            # For now, query backend directly with telegram_id
            resp = await client.get(
                f"{settings.backend_url}/api/economy/balance",
                headers={"X-Telegram-Id": str(message.from_user.id)},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                balance = data.get("balance", 0)
                wallet = data.get("wallet", "не подключён")
                await message.answer(
                    f"💰 <b>Ваш баланс</b>\n\n"
                    f"CHIP: <code>{balance:.2f}</code>\n"
                    f"Кошелёк: <code>{wallet or 'не подключён'}</code>",
                    parse_mode="HTML",
                )
                return
    except Exception:
        pass

    await message.answer(
        "💰 Для просмотра баланса откройте приложение:",
        reply_markup=get_webapp_button(),
    )


@router.message(Command("profile"))
@router.message(F.text == "👤 Профиль")
async def cmd_profile(message: Message):
    user = message.from_user
    await message.answer(
        f"👤 <b>Профиль</b>\n\n"
        f"Имя: {user.first_name}\n"
        f"Username: @{user.username or '—'}\n"
        f"ID: <code>{user.id}</code>\n\n"
        "Подробная статистика доступна в приложении:",
        parse_mode="HTML",
        reply_markup=get_webapp_button(),
    )
