from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import database as db_ops
from app.dependencies import get_db, require_api_key
from app.models import GlobalSettings, SuccessResponse, Theme

logger = logging.getLogger(__name__)

# No prefix — settings and themes are at different top-level paths.
router = APIRouter(tags=["settings"])


# ---------------------------------------------------------------------------
# Global settings
# ---------------------------------------------------------------------------

@router.get("/api/config/settings", response_model=GlobalSettings)
async def get_settings(db: Session = Depends(get_db)) -> GlobalSettings:
    """Return global application settings."""
    return db_ops.get_settings(db)


@router.put(
    "/api/config/settings",
    response_model=SuccessResponse,
    dependencies=[Depends(require_api_key)],
)
async def update_settings(
    body: GlobalSettings, db: Session = Depends(get_db)
) -> SuccessResponse:
    """Replace global settings. All fields are required."""
    db_ops.save_settings(db, body)
    logger.info("Global settings updated: theme='%s' kiosk=%s", body.theme, body.kiosk)
    return SuccessResponse()


# ---------------------------------------------------------------------------
# Themes
# ---------------------------------------------------------------------------

@router.get("/api/config/themes", response_model=List[Theme])
async def list_themes(db: Session = Depends(get_db)) -> List[Theme]:
    """Return all themes (built-in and custom)."""
    return db_ops.get_themes(db)


@router.post(
    "/api/config/themes",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
async def upsert_theme(body: Theme, db: Session = Depends(get_db)) -> SuccessResponse:
    """Add a new theme or update an existing one by ID."""
    db_ops.upsert_theme(db, body)
    logger.info("Theme upserted: id='%s'", body.id)
    return SuccessResponse()
