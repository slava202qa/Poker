from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.tables import router as tables_router
from app.api.tournaments import router as tournaments_router
from app.api.economy import router as economy_router
from app.api.profile import router as profile_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(tables_router)
api_router.include_router(tournaments_router)
api_router.include_router(economy_router)
api_router.include_router(profile_router)
