"""Telegram Poker Bot — aiogram 3 with RR exchange."""
import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery
from config import get_bot_settings
from handlers import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    settings = get_bot_settings()

    if not settings.bot_token:
        logger.error("BOT_TOKEN not set")
        return

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    # Global cancel handler
    @dp.callback_query(F.data == "cancel")
    async def cancel_handler(callback: CallbackQuery):
        await callback.message.edit_text("❌ Отменено.")
        await callback.answer()

    logger.info("Bot starting...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
