"""FastAPI application entry point."""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.api import api_router
from app.ws import manager as ws_manager
from app.game_manager import handle_ws_message
from app.ton.ton_listener import poll_deposits

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")

    # Start TON deposit listener
    deposit_task = asyncio.create_task(poll_deposits())

    yield

    # Shutdown
    deposit_task.cancel()
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
    user_id: int = Query(...),
):
    """
    WebSocket endpoint for real-time game communication.
    Client connects with: ws://host/ws/table/{table_id}?user_id={user_id}
    """
    await ws_manager.connect(table_id, user_id, websocket)

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
