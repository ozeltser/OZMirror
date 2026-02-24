from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import jsonschema
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app import database as db_ops
from app.dependencies import get_db, require_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["validate"])


class ValidateConfigRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    moduleId: str
    config: Dict[str, Any]


class ValidateConfigResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    valid: bool
    errors: Optional[list[str]] = None


@router.post(
    "/validate",
    response_model=ValidateConfigResponse,
    dependencies=[Depends(require_api_key)],
)
async def validate_config(
    body: ValidateConfigRequest, db: Session = Depends(get_db)
) -> ValidateConfigResponse:
    """
    Validate a module instance config against the module's JSON Schema.

    Returns ``{"valid": true}`` when the config satisfies the schema, or
    ``{"valid": false, "errors": [...]}`` listing each validation failure.
    Returns 404 if the module is not registered or has no configSchema.
    """
    mod = db_ops.get_module(db, body.moduleId)
    if mod is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{body.moduleId}' not found",
        )

    schema: Optional[Dict[str, Any]] = mod.manifest.configSchema if mod.manifest else None
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{body.moduleId}' has no configSchema",
        )

    validator = jsonschema.Draft7Validator(schema)
    errors = [e.message for e in sorted(validator.iter_errors(body.config), key=str)]

    if errors:
        logger.debug(
            "Config validation failed for module '%s': %d error(s)", body.moduleId, len(errors)
        )
        return ValidateConfigResponse(valid=False, errors=errors)

    logger.debug("Config validation passed for module '%s'", body.moduleId)
    return ValidateConfigResponse(valid=True)
