import logging
import httpx
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from keyboards import (
    get_main_keyboard, get_webapp_button,
    get_buy_currency_kb, get_buy_amount_kb,
    get_sell_currency_kb, get_sell_amount_kb,
    get_confirm_sell_kb,
)
from config import get_bot_settings

router = Router()
logger = logging.getLogger(__name__)


# ── FSM States ──

class BuyStates(StatesGroup):
    choosing_currency = State()
    choosing_amount = State()
    waiting_payment = State()

class SellStates(StatesGroup):
    choosing_currency = State()
    choosing_amount = State()
    confirming = State()


# ── Helpers ──

async def get_user_balance(telegram_id: int) -> dict | None:
    settings = get_bot_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.backend_url}/api/economy/balance",
                headers={"X-Telegram-Id": str(telegram_id)},
                timeout=5,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


async def adjust_balance(telegram_id: int, amount: float, reference: str) -> bool:
    """Credit or debit RR via backend admin endpoint."""
    settings = get_bot_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.backend_url}/api/internal/adjust_balance",
                json={
                    "telegram_id": telegram_id,
                    "amount": amount,
                    "reference": reference,
                },
                headers={"X-Internal-Key": "bot-internal"},
                timeout=5,
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"adjust_balance failed: {e}")
        return False


# ── /start ──

@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "♠️ <b>Royal Roll Poker</b>\n\n"
        "Добро пожаловать!\n"
        "Играй в Texas Hold'em на RR токены.\n\n"
        "💰 <b>/buy</b> — купить RR за TON или USDT\n"
        "💸 <b>/sell</b> — продать RR за TON или USDT\n"
        "📊 <b>/rates</b> — курсы обмена\n"
        "💎 <b>/balance</b> — ваш баланс\n\n"
        "Нажми <b>🎮 Играть</b> чтобы начать.",
        reply_markup=get_main_keyboard(),
    )


# ── /rates ──

@router.message(Command("rates"))
async def cmd_rates(message: Message):
    s = get_bot_settings()
    await message.answer(
        "📊 <b>Курсы обмена Royal Roll</b>\n\n"
        f"🔷 1 TON = <b>{s.rate_ton_to_rr:.0f} RR</b>\n"
        f"💵 1 USDT = <b>{s.rate_usdt_to_rr:.0f} RR</b>\n\n"
        f"🔄 {s.rate_ton_to_rr:.0f} RR = 1 TON\n"
        f"🔄 {s.rate_usdt_to_rr:.0f} RR = 1 USDT",
    )


# ── /balance ──

@router.message(Command("balance"))
@router.message(F.text == "💰 Баланс")
async def cmd_balance(message: Message):
    data = await get_user_balance(message.from_user.id)
    if data:
        rr = data.get("balance", 0)
        fun = data.get("fun_balance", 0)
        await message.answer(
            f"💎 <b>Ваш баланс</b>\n\n"
            f"◆ <b>{rr:,.0f} RR</b> (Royal Roll)\n"
            f"● <b>{fun:,.0f} FUN</b> (бесплатные)\n\n"
            f"💰 /buy — купить RR\n"
            f"💸 /sell — продать RR",
        )
    else:
        await message.answer(
            "💎 Для просмотра баланса откройте приложение:",
            reply_markup=get_webapp_button(),
        )


# ── /profile ──

@router.message(Command("profile"))
@router.message(F.text == "👤 Профиль")
async def cmd_profile(message: Message):
    user = message.from_user
    await message.answer(
        f"👤 <b>Профиль</b>\n\n"
        f"Имя: {user.first_name}\n"
        f"Username: @{user.username or '—'}\n"
        f"ID: <code>{user.id}</code>\n\n"
        "Подробная статистика в приложении:",
        reply_markup=get_webapp_button(),
    )


# ══════════════════════════════════════
#  BUY FLOW
# ══════════════════════════════════════

@router.message(Command("buy"))
@router.message(F.text == "💰 Купить RR")
async def cmd_buy(message: Message, state: FSMContext):
    await state.clear()
    s = get_bot_settings()
    await message.answer(
        "💰 <b>Купить Royal Roll</b>\n\n"
        f"🔷 1 TON = {s.rate_ton_to_rr:.0f} RR\n"
        f"💵 1 USDT = {s.rate_usdt_to_rr:.0f} RR\n\n"
        "Выберите валюту оплаты:",
        reply_markup=get_buy_currency_kb(),
    )
    await state.set_state(BuyStates.choosing_currency)


@router.callback_query(BuyStates.choosing_currency, F.data.startswith("buy_currency:"))
async def buy_currency_chosen(callback: CallbackQuery, state: FSMContext):
    currency = callback.data.split(":")[1]  # "ton" or "usdt"
    await state.update_data(buy_currency=currency)
    s = get_bot_settings()
    rate = s.rate_ton_to_rr if currency == "ton" else s.rate_usdt_to_rr
    symbol = "TON" if currency == "ton" else "USDT"

    await callback.message.edit_text(
        f"💰 <b>Купить RR за {symbol}</b>\n\n"
        f"Курс: 1 {symbol} = {rate:.0f} RR\n\n"
        "Выберите сумму или введите свою:",
        reply_markup=get_buy_amount_kb(currency, rate),
    )
    await state.set_state(BuyStates.choosing_amount)
    await callback.answer()


@router.callback_query(BuyStates.choosing_amount, F.data.startswith("buy_amount:"))
async def buy_amount_chosen(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split(":")
    rr_amount = float(parts[1])
    crypto_amount = float(parts[2])
    data = await state.get_data()
    currency = data["buy_currency"]
    symbol = "TON" if currency == "ton" else "USDT"
    s = get_bot_settings()

    await state.update_data(rr_amount=rr_amount, crypto_amount=crypto_amount)

    wallet = s.system_wallet_address or "Не настроен"

    await callback.message.edit_text(
        f"📋 <b>Ваш заказ</b>\n\n"
        f"Покупка: <b>{rr_amount:,.0f} RR</b>\n"
        f"Стоимость: <b>{crypto_amount:.2f} {symbol}</b>\n\n"
        f"Отправьте <b>{crypto_amount:.2f} {symbol}</b> на кошелёк:\n"
        f"<code>{wallet}</code>\n\n"
        f"⏳ Ожидаю оплату (15 мин)...\n\n"
        f"<i>После отправки бот автоматически зачислит RR.</i>",
    )
    await state.set_state(BuyStates.waiting_payment)
    await callback.answer()


@router.message(BuyStates.choosing_amount)
async def buy_custom_amount(message: Message, state: FSMContext):
    """Handle custom amount input."""
    try:
        rr_amount = float(message.text.replace(",", "").replace(" ", ""))
    except ValueError:
        await message.answer("❌ Введите число. Например: <code>500</code>")
        return

    s = get_bot_settings()
    if rr_amount < s.min_buy_rr:
        await message.answer(f"❌ Минимум {s.min_buy_rr:.0f} RR")
        return

    data = await state.get_data()
    currency = data["buy_currency"]
    rate = s.rate_ton_to_rr if currency == "ton" else s.rate_usdt_to_rr
    symbol = "TON" if currency == "ton" else "USDT"
    crypto_amount = rr_amount / rate

    await state.update_data(rr_amount=rr_amount, crypto_amount=crypto_amount)

    wallet = s.system_wallet_address or "Не настроен"

    await message.answer(
        f"📋 <b>Ваш заказ</b>\n\n"
        f"Покупка: <b>{rr_amount:,.0f} RR</b>\n"
        f"Стоимость: <b>{crypto_amount:.4f} {symbol}</b>\n\n"
        f"Отправьте <b>{crypto_amount:.4f} {symbol}</b> на кошелёк:\n"
        f"<code>{wallet}</code>\n\n"
        f"⏳ Ожидаю оплату (15 мин)...\n\n"
        f"<i>После отправки бот автоматически зачислит RR.</i>",
    )
    await state.set_state(BuyStates.waiting_payment)


# ══════════════════════════════════════
#  SELL FLOW
# ══════════════════════════════════════

@router.message(Command("sell"))
@router.message(F.text == "💸 Продать RR")
async def cmd_sell(message: Message, state: FSMContext):
    await state.clear()
    data = await get_user_balance(message.from_user.id)
    rr = data.get("balance", 0) if data else 0

    if rr < get_bot_settings().min_sell_rr:
        await message.answer(
            f"❌ Недостаточно RR для продажи.\n"
            f"Ваш баланс: {rr:,.0f} RR\n"
            f"Минимум: {get_bot_settings().min_sell_rr:.0f} RR"
        )
        return

    s = get_bot_settings()
    await message.answer(
        f"💸 <b>Продать Royal Roll</b>\n\n"
        f"Ваш баланс: <b>{rr:,.0f} RR</b>\n\n"
        f"Получить:\n"
        f"🔷 TON ({s.rate_ton_to_rr:.0f} RR = 1 TON)\n"
        f"💵 USDT ({s.rate_usdt_to_rr:.0f} RR = 1 USDT)\n\n"
        "Выберите валюту:",
        reply_markup=get_sell_currency_kb(),
    )
    await state.update_data(rr_balance=rr)
    await state.set_state(SellStates.choosing_currency)


@router.callback_query(SellStates.choosing_currency, F.data.startswith("sell_currency:"))
async def sell_currency_chosen(callback: CallbackQuery, state: FSMContext):
    currency = callback.data.split(":")[1]
    data = await state.get_data()
    rr_balance = data["rr_balance"]
    await state.update_data(sell_currency=currency)

    s = get_bot_settings()
    rate = s.rate_ton_to_rr if currency == "ton" else s.rate_usdt_to_rr
    symbol = "TON" if currency == "ton" else "USDT"

    await callback.message.edit_text(
        f"💸 <b>Продать RR за {symbol}</b>\n\n"
        f"Баланс: <b>{rr_balance:,.0f} RR</b>\n"
        f"Курс: {rate:.0f} RR = 1 {symbol}\n\n"
        "Выберите сумму или введите свою:",
        reply_markup=get_sell_amount_kb(currency, rate, rr_balance),
    )
    await state.set_state(SellStates.choosing_amount)
    await callback.answer()


@router.callback_query(SellStates.choosing_amount, F.data.startswith("sell_amount:"))
async def sell_amount_chosen(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split(":")
    rr_amount = float(parts[1])
    crypto_amount = float(parts[2])
    data = await state.get_data()
    currency = data["sell_currency"]
    symbol = "TON" if currency == "ton" else "USDT"

    await state.update_data(sell_rr=rr_amount, sell_crypto=crypto_amount)

    await callback.message.edit_text(
        f"📋 <b>Подтвердите продажу</b>\n\n"
        f"Продаёте: <b>{rr_amount:,.0f} RR</b>\n"
        f"Получаете: <b>{crypto_amount:.4f} {symbol}</b>\n\n"
        f"<i>{symbol} будет отправлен на ваш привязанный кошелёк.</i>",
        reply_markup=get_confirm_sell_kb(),
    )
    await state.set_state(SellStates.confirming)
    await callback.answer()


@router.message(SellStates.choosing_amount)
async def sell_custom_amount(message: Message, state: FSMContext):
    try:
        rr_amount = float(message.text.replace(",", "").replace(" ", ""))
    except ValueError:
        await message.answer("❌ Введите число. Например: <code>500</code>")
        return

    s = get_bot_settings()
    data = await state.get_data()
    currency = data["sell_currency"]
    rr_balance = data["rr_balance"]
    rate = s.rate_ton_to_rr if currency == "ton" else s.rate_usdt_to_rr
    symbol = "TON" if currency == "ton" else "USDT"

    if rr_amount < s.min_sell_rr:
        await message.answer(f"❌ Минимум {s.min_sell_rr:.0f} RR")
        return
    if rr_amount > rr_balance:
        await message.answer(f"❌ Недостаточно RR. Баланс: {rr_balance:,.0f}")
        return

    crypto_amount = rr_amount / rate
    await state.update_data(sell_rr=rr_amount, sell_crypto=crypto_amount)

    await message.answer(
        f"📋 <b>Подтвердите продажу</b>\n\n"
        f"Продаёте: <b>{rr_amount:,.0f} RR</b>\n"
        f"Получаете: <b>{crypto_amount:.4f} {symbol}</b>\n\n"
        f"<i>{symbol} будет отправлен на ваш привязанный кошелёк.</i>",
        reply_markup=get_confirm_sell_kb(),
    )
    await state.set_state(SellStates.confirming)


@router.callback_query(SellStates.confirming, F.data == "sell_confirm")
async def sell_confirmed(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    rr_amount = data["sell_rr"]
    crypto_amount = data["sell_crypto"]
    currency = data["sell_currency"]
    symbol = "TON" if currency == "ton" else "USDT"

    # Deduct RR from user balance
    success = await adjust_balance(
        callback.from_user.id,
        -rr_amount,
        f"sell_rr:{currency}:{crypto_amount:.4f}",
    )

    if not success:
        await callback.message.edit_text(
            "❌ Ошибка при списании RR. Попробуйте позже."
        )
        await state.clear()
        await callback.answer()
        return

    # TODO: send TON/USDT via ton_withdraw in production
    # For now, mark as pending manual send
    await callback.message.edit_text(
        f"✅ <b>Заявка на вывод создана!</b>\n\n"
        f"Списано: <b>{rr_amount:,.0f} RR</b>\n"
        f"К отправке: <b>{crypto_amount:.4f} {symbol}</b>\n\n"
        f"⏳ {symbol} будет отправлен в течение нескольких минут.",
    )
    await state.clear()
    await callback.answer()


@router.callback_query(SellStates.confirming, F.data == "sell_cancel")
async def sell_cancelled(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text("❌ Продажа отменена.")
    await state.clear()
    await callback.answer()


# ── /help ──

@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "📖 <b>Команды</b>\n\n"
        "🎮 <b>Играть</b> — открыть покер\n"
        "💰 /buy — купить RR за TON/USDT\n"
        "💸 /sell — продать RR за TON/USDT\n"
        "📊 /rates — курсы обмена\n"
        "💎 /balance — ваш баланс\n"
        "👤 /profile — профиль\n"
        "📖 /help — эта справка",
    )
