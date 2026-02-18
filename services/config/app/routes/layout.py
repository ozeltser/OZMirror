from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import database as db_ops
from app.dependencies import get_db, require_api_key
from app.models import (
    CreateProfileRequest,
    LayoutData,
    LayoutProfile,
    SuccessResponse,
    UpdateLayoutRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config/layout", tags=["layout"])


@router.get("", response_model=LayoutData)
async def get_layout(db: Session = Depends(get_db)) -> LayoutData:
    """Return the full layout document (all profiles, active profile name)."""
    return db_ops.get_layout(db)


@router.put("", response_model=SuccessResponse, dependencies=[Depends(require_api_key)])
async def update_layout(
    body: UpdateLayoutRequest, db: Session = Depends(get_db)
) -> SuccessResponse:
    """
    Save a profile's grid and moduleConfigs.

    The profile named in `body.profileName` is upserted into the layout
    document. Other profiles are not modified.
    """
    profile = LayoutProfile(grid=body.grid, moduleConfigs=body.moduleConfigs)
    db_ops.upsert_profile_content(db, body.profileName, profile)
    logger.info("Layout profile '%s' updated", body.profileName)
    return SuccessResponse()


@router.get("/profiles", response_model=List[str])
async def list_profiles(db: Session = Depends(get_db)) -> List[str]:
    """Return names of all saved layout profiles."""
    return db_ops.get_profiles(db)


@router.post(
    "/profiles",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
async def create_profile(
    body: CreateProfileRequest, db: Session = Depends(get_db)
) -> SuccessResponse:
    """Create a new profile, optionally cloning an existing one."""
    profiles = db_ops.get_profiles(db)

    if body.name in profiles:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Profile '{body.name}' already exists",
        )
    if body.copyFrom not in profiles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source profile '{body.copyFrom}' not found",
        )

    db_ops.create_profile(db, body.name, body.copyFrom)
    logger.info("Created layout profile '%s' (copied from '%s')", body.name, body.copyFrom)
    return SuccessResponse()


@router.delete(
    "/profiles/{name}",
    response_model=SuccessResponse,
    dependencies=[Depends(require_api_key)],
)
async def delete_profile(name: str, db: Session = Depends(get_db)) -> SuccessResponse:
    """
    Delete a layout profile.

    The 'default' profile cannot be deleted. If the deleted profile was active,
    the active profile is reset to 'default'.
    """
    if name == "default":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'default' profile cannot be deleted",
        )

    profiles = db_ops.get_profiles(db)
    if name not in profiles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile '{name}' not found",
        )

    db_ops.delete_profile(db, name)
    logger.info("Deleted layout profile '%s'", name)
    return SuccessResponse()
