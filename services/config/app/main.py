from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.database import SessionLocal, create_tables, seed_defaults
from app.models import HealthResponse
from app.routes import layout, modules, settings

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log_level = os.getenv("LOG_LEVEL", "info").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Create tables and seed default data on startup.
    Both operations are idempotent — safe to call on every container start.
    """
    logger.info("Starting up: initialising database")
    create_tables()
    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()
    logger.info("Database ready")
    yield
    logger.info("Shutting down")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="OzMirror Configuration Service",
    description="Central configuration store for OzMirror — layouts, modules, settings, themes.",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

_start_time = time.monotonic()

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,    # API key auth — no cookies needed
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["X-API-Key", "Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# Global exception handler — prevent leaking stack traces to clients
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred"},
    )

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(layout.router)
app.include_router(modules.router)
app.include_router(settings.router)

# ---------------------------------------------------------------------------
# Health and root
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["infrastructure"])
async def health() -> HealthResponse:
    """
    Liveness probe. Returns 200 while the process is alive.
    Matched by the Dockerfile HEALTHCHECK and docker-compose healthcheck.
    """
    return HealthResponse(
        status="healthy",
        version=__version__,
        uptime=round(time.monotonic() - _start_time, 2),
    )


@app.get("/", tags=["infrastructure"])
async def root() -> dict:
    """Service identity endpoint."""
    return {
        "service": "OzMirror Configuration Service",
        "version": __version__,
        "status": "running",
    }
