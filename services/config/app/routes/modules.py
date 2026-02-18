from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import database as db_ops
from app.dependencies import get_db, require_api_key
from app.models import (
    RegisteredModule,
    RegisterModuleRequest,
    SuccessResponse,
    UpdateInstanceConfigRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config/modules", tags=["modules"])


@router.get("", response_model=List[RegisteredModule])
async def list_modules(db: Session = Depends(get_db)) -> List[RegisteredModule]:
    """Return all registered modules."""
    return db_ops.get_modules(db)


@router.get("/{module_id}", response_model=RegisteredModule)
async def get_module(module_id: str, db: Session = Depends(get_db)) -> RegisteredModule:
    """Return a specific registered module by ID."""
    mod = db_ops.get_module(db, module_id)
    if mod is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_id}' not found",
        )
    return mod


@router.post(
    "/register",
    response_model=SuccessResponse,
    dependencies=[Depends(require_api_key)],
)
async def register_module(
    body: RegisterModuleRequest, db: Session = Depends(get_db)
) -> SuccessResponse:
    """
    Register or update a module in the registry.

    Modules call this on container startup. If the module was already registered
    (e.g. after a restart), the record is replaced in full.
    """
    module = RegisteredModule(**body.model_dump())
    db_ops.register_module(db, module)
    logger.info("Module '%s' registered from %s", module.id, module.serviceUrl)
    return SuccessResponse()


@router.get(
    "/{module_id}/config/{instance_id}",
    response_model=Dict[str, Any],
)
async def get_instance_config(
    module_id: str, instance_id: str, db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Return the saved config for one module instance.

    Falls back to the module's manifest defaultConfig if no saved config exists.
    Returns 404 only if neither a saved config nor a registered module can be found.
    """
    config = db_ops.get_instance_config(db, module_id, instance_id)
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No config found for instance '{instance_id}' of module '{module_id}'",
        )
    return config


@router.put(
    "/{module_id}/config/{instance_id}",
    response_model=SuccessResponse,
    dependencies=[Depends(require_api_key)],
)
async def update_instance_config(
    module_id: str,
    instance_id: str,
    body: UpdateInstanceConfigRequest,
    db: Session = Depends(get_db),
) -> SuccessResponse:
    """
    Replace the config for a module instance in the active layout profile.

    Returns 404 if instance_id does not exist in the active profile's moduleConfigs.
    The client should PUT the full config object, not a patch.
    """
    config_data = body.model_dump()
    saved = db_ops.set_instance_config(db, instance_id, config_data)
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found in active layout profile",
        )
    logger.info(
        "Updated instance config: module='%s' instance='%s'", module_id, instance_id
    )
    return SuccessResponse()
