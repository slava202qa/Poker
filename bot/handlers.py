import logging
import os
from aiogram import Router
from aiogram.types import Message, FSInputFile
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
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
    "💳 Управление балансом и обмен наград — внутри приложения.\n\n"
    "👇 Нажми <b>♠️ ВХОД В ЗАЛ</b>, чтобы начать игру."
)


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
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
        "Нажмите <b>ВХОД В ЗАЛ</b> для входа в приложение.\n\n"
        "Все функции доступны внутри Mini App:\n"
        "• Игра за столами\n"
        "• Турниры\n"
        "• Управление активами\n"
        "• Профиль и достижения",
        parse_mode="HTML",
        reply_markup=get_webapp_button(),
    )
