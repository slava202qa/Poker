"""FastAPI application entry point."""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base, async_session
from app.api import api_router
from app.api.deps import validate_init_data
from app.ws import manager as ws_manager
from app.game_manager import handle_ws_message
from app.ton.ton_listener import poll_deposits
from app.ton.ton_withdraw import process_pending_withdrawals

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")

    # Seed Season 1 battle pass if not exists
    from app.api.battlepass import seed_season_1
    from app.database import async_session as _session_factory
    async with _session_factory() as _db:
        await seed_season_1(_db)

    # Start TON deposit listener
    deposit_task = asyncio.create_task(poll_deposits())

    # Start withdrawal processor (runs every 30s)
    async def _withdrawal_loop():
        while True:
            await process_pending_withdrawals()
            await asyncio.sleep(30)

    withdrawal_task = asyncio.create_task(_withdrawal_loop())

    yield

    # Shutdown
    deposit_task.cancel()
    withdrawal_task.cancel()
    await engine.dispose()


settings = get_settings()

app = FastAPI(
    title="Poker Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/table/{table_id}")
async def websocket_table(
    websocket: WebSocket,
    table_id: int,
    init_data: str = Query(..., alias="initData"),
):
    """
    WebSocket endpoint for real-time game communication.
    Client connects with: ws://host/ws/table/{table_id}?initData=<telegram_init_data>

    initData is validated via HMAC-SHA256 before accepting the connection.
    user_id is extracted from the validated payload — never trusted from client.
    """
    cfg = get_settings()

    # Validate initData before accepting the connection
    try:
        tg_user = validate_init_data(init_data, cfg.bot_token)
        telegram_id = tg_user["id"]
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Resolve internal user_id from telegram_id
    from sqlalchemy import select
    from app.models.user import User
    try:
        async with async_session() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            db_user = result.scalar_one_or_none()
            if db_user is None:
                await websocket.close(code=4002, reason="User not found")
                return
            user_id = db_user.id
    except Exception as e:
        logger.error(f"WS auth DB error: {e}")
        await websocket.close(code=4003, reason="Internal error")
        return

    await ws_manager.connect(table_id, user_id, websocket)
    logger.info(f"WS authenticated: tg={telegram_id} user_id={user_id} table={table_id}")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            result = await handle_ws_message(table_id, user_id, data)
            await websocket.send_json(result)

    except WebSocketDisconnect:
        ws_manager.disconnect(table_id, user_id)
    except Exception as e:
        logger.error(f"WS error: {e}")
        ws_manager.disconnect(table_id, user_id)
