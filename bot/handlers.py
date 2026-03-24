import logging
import os
from aiogram import Router, F
from aiogram.types import Message, FSInputFile, ReplyKeyboardRemove
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.exceptions import TelegramBadRequest
from keyboards import get_main_keyboard, get_webapp_button, get_admin_button, ADMIN_IDS

router = Router()
logger = logging.getLogger(__name__)

BANNER_PATH = os.path.join(os.path.dirname(__file__), "banner.png")

WELCOME_TEXT = (
    "♠️ <b>Royal Roll Club</b> — добро пожаловать в закрытое сообщество "
    "любителей спортивного покера.\n\n"
    "Здесь мастерство встречается с азартом в эксклюзивной атмосфере "
    "<b>Black &amp; Gold</b>.\n\n"
    "💎 <b>Ваши возможности:</b>\n"
    "• Участие в ежедневных турнирах\n"
    "• Управление Клубными Активами\n"
    "• Доступ к VIP-залам\n\n"
    "👇 Нажми <b>♠️ ВХОД В ЗАЛ</b>, чтобы начать игру."
)

DEPOSIT_TEXT = (
    "💳 <b>Пополнение баланса</b>\n\n"
    "Для пополнения счёта обратитесь к менеджеру клуба:\n\n"
    "👤 <b>@RoyalRoll_Manager</b>\n\n"
    "Укажите:\n"
    "• Ваш Telegram username\n"
    "• Сумму пополнения\n"
    "• Способ оплаты\n\n"
    "⏱ Зачисление в течение 15 минут."
)

DEPOSIT_KEYWORDS = [
    "депозит", "пополн", "купить", "купи", "buy", "deposit",
    "внести", "закинуть", "закинь", "баланс", "rr", "рр",
    "реквизит", "оплат", "перевод",
]


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    rm = await message.answer("​", reply_markup=ReplyKeyboardRemove())
    try:
        await rm.delete()
    except TelegramBadRequest:
        pass
    kb = get_main_keyboard(message.from_user.id)
    if os.path.exists(BANNER_PATH):
        await message.answer_photo(
            photo=FSInputFile(BANNER_PATH),
            caption=WELCOME_TEXT,
            parse_mode="HTML",
            reply_markup=kb,
        )
    else:
        await message.answer(WELCOME_TEXT, parse_mode="HTML", reply_markup=kb)


@router.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("⛔ Нет доступа.")
        return
    await message.answer(
        "⚙️ <b>Админ панель</b>",
        parse_mode="HTML",
        reply_markup=get_admin_button(),
    )


@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "♠️ <b>Royal Roll Club</b>\n\n"
        "Нажмите <b>♠️ ВХОД В ЗАЛ</b> для входа в приложение.\n\n"
        "Все функции доступны внутри Mini App:\n"
        "• Игра за столами\n"
        "• Турниры\n"
        "• Управление активами\n"
        "• Профиль и достижения",
        parse_mode="HTML",
        reply_markup=get_webapp_button(),
    )


@router.message(Command("deposit"))
async def cmd_deposit(message: Message):
    await message.answer(DEPOSIT_TEXT, parse_mode="HTML")


@router.message(F.text)
async def handle_text(message: Message):
    text_lower = (message.text or "").lower()
    if any(kw in text_lower for kw in DEPOSIT_KEYWORDS):
        await message.answer(DEPOSIT_TEXT, parse_mode="HTML")
