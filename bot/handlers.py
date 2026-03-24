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
    "\u2660\ufe0f <b>Royal Roll Club</b> \u2014 \u0434\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 \u0437\u0430\u043a\u0440\u044b\u0442\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e "
    "\u043b\u044e\u0431\u0438\u0442\u0435\u043b\u0435\u0439 \u0441\u043f\u043e\u0440\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u043f\u043e\u043a\u0435\u0440\u0430.\n\n"
    "\u0417\u0434\u0435\u0441\u044c \u043c\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u043e \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442\u0441\u044f \u0441 \u0430\u0437\u0430\u0440\u0442\u043e\u043c \u0432 \u044d\u043a\u0441\u043a\u043b\u044e\u0437\u0438\u0432\u043d\u043e\u0439 \u0430\u0442\u043c\u043e\u0441\u0444\u0435\u0440\u0435 "
    "<b>Black &amp; Gold</b>.\n\n"
    "\U0001f48e <b>\u0412\u0430\u0448\u0438 \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0438:</b>\n"
    "\u2022 \u0423\u0447\u0430\u0441\u0442\u0438\u0435 \u0432 \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0445 \u0442\u0443\u0440\u043d\u0438\u0440\u0430\u0445\n"
    "\u2022 \u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u041a\u043b\u0443\u0431\u043d\u044b\u043c\u0438 \u0410\u043a\u0442\u0438\u0432\u0430\u043c\u0438\n"
    "\u2022 \u0414\u043e\u0441\u0442\u0443\u043f \u043a VIP-\u0437\u0430\u043b\u0430\u043c\n\n"
    "\U0001f447 \u041d\u0430\u0436\u043c\u0438 <b>\u2660\ufe0f \u0412\u0425\u041e\u0414 \u0412 \u0417\u0410\u041b</b>, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u0438\u0433\u0440\u0443."
)

DEPOSIT_TEXT = (
    "\U0001f4b3 <b>\u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u0431\u0430\u043b\u0430\u043d\u0441\u0430</b>\n\n"
    "\u0414\u043b\u044f \u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f \u0441\u0447\u0451\u0442\u0430 \u043e\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044c \u043a \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443 \u043a\u043b\u0443\u0431\u0430:\n\n"
    "\U0001f464 <b>@RoyalRoll_Manager</b>\n\n"
    "\u0423\u043a\u0430\u0436\u0438\u0442\u0435:\n"
    "\u2022 \u0412\u0430\u0448 Telegram username\n"
    "\u2022 \u0421\u0443\u043c\u043c\u0443 \u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f\n"
    "\u2022 \u0421\u043f\u043e\u0441\u043e\u0431 \u043e\u043f\u043b\u0430\u0442\u044b\n\n"
    "\u23f1 \u0417\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u0435 \u0432 \u0442\u0435\u0447\u0435\u043d\u0438\u0435 15 \u043c\u0438\u043d\u0443\u0442."
)

DEPOSIT_KEYWORDS = [
    "\u0434\u0435\u043f\u043e\u0437\u0438\u0442", "\u043f\u043e\u043f\u043e\u043b\u043d", "\u043a\u0443\u043f\u0438\u0442\u044c", "\u043a\u0443\u043f\u0438", "buy", "deposit",
    "\u0432\u043d\u0435\u0441\u0442\u0438", "\u0437\u0430\u043a\u0438\u043d\u0443\u0442\u044c", "\u0437\u0430\u043a\u0438\u043d\u044c", "\u0431\u0430\u043b\u0430\u043d\u0441", "rr", "\u0440\u0440",
    "\u0440\u0435\u043a\u0432\u0438\u0437\u0438\u0442", "\u043e\u043f\u043b\u0430\u0442", "\u043f\u0435\u0440\u0435\u0432\u043e\u0434",
]


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    try:
        rm = await message.answer("•", reply_markup=ReplyKeyboardRemove())
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
        await message.answer("\u26d4 \u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430.")
        return
    await message.answer(
        "\u2699\ufe0f <b>\u0410\u0434\u043c\u0438\u043d \u043f\u0430\u043d\u0435\u043b\u044c</b>",
        parse_mode="HTML",
        reply_markup=get_admin_button(),
    )


@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "\u2660\ufe0f <b>Royal Roll Club</b>\n\n"
        "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 <b>\u2660\ufe0f \u0412\u0425\u041e\u0414 \u0412 \u0417\u0410\u041b</b> \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430 \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435.",
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
