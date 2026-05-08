from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import structlog

from app.config import settings
from app.core.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware
from app.routers import auth, matches, predictions, teams, live, analytics, backtest, admin, subscriptions
from app.websockets.manager import ws_manager
from app.websockets.espn_poller import espn_poll_loop

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Football AI Platform", version=settings.APP_VERSION, env=settings.ENVIRONMENT)
    poll_task = asyncio.create_task(espn_poll_loop(ws_manager))
    try:
        yield
    finally:
        poll_task.cancel()
        try:
            await poll_task
        except asyncio.CancelledError:
            pass
        logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered football analytics and match prediction platform",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ─── Rate limiter ──────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ───────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    max_age=600,  # preflight cache: 10 min
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# ─── Routers ─────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Authentication"])
app.include_router(matches.router,       prefix="/api/v1/matches",        tags=["Matches"])
app.include_router(predictions.router,   prefix="/api/v1/predictions",    tags=["Predictions"])
app.include_router(teams.router,         prefix="/api/v1/teams",          tags=["Teams"])
app.include_router(live.router,          prefix="/api/v1/live",           tags=["Live"])
app.include_router(analytics.router,     prefix="/api/v1/analytics",      tags=["Analytics"])
app.include_router(backtest.router,      prefix="/api/v1/backtest",       tags=["Backtest"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions",  tags=["Subscriptions"])
app.include_router(admin.router,         prefix="/api/v1/admin",          tags=["Admin"])

# ─── WebSocket ────────────────────────────────
from app.websockets.live_handler import router as ws_router
app.include_router(ws_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}
