from __future__ import annotations

import logging
import os
import secrets
from typing import Generator

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.database import SessionLocal

logger = logging.getLogger(__name__)

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(
    api_key: str | None = Security(_api_key_header),
) -> None:
    """
    Dependency that enforces API key authentication on write endpoints.

    Uses secrets.compare_digest() to prevent timing-based key enumeration.
    Logs auth failures at WARNING level without echoing the submitted key.
    """
    expected = os.getenv("API_KEY", "")
    if not expected:
        logger.error("API_KEY environment variable is not set — rejecting write request")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service not configured for authenticated requests",
        )

    if not api_key or not secrets.compare_digest(api_key, expected):
        logger.warning("Rejected request with invalid API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a database session.

    The session is always closed after the request completes, even if an
    exception is raised. SQLAlchemy rolls back any uncommitted transaction
    on session close.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
