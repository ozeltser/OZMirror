"""
Shared pytest fixtures for the Config Service test suite.

Strategy
--------
* The production `database.py` creates a MySQL engine at import time but
  `create_engine()` is lazy (no real connection until first query), so the
  import itself never fails.
* We patch `app.database.engine` and `app.database.SessionLocal` to point
  at an in-memory SQLite engine BEFORE importing `app.main`.  This means
  that when `app.main` executes `from app.database import SessionLocal`,
  it picks up the SQLite factory — so the lifespan's `create_tables()` and
  `seed_defaults()` calls use SQLite, not MySQL.
* We also override the `get_db` FastAPI dependency so every HTTP request in
  tests uses the same SQLite session factory.
* The `reset_db` autouse fixture drops and recreates all tables between
  tests for full isolation.
"""
from __future__ import annotations

import os

# Must be set BEFORE any app module is imported.
os.environ["API_KEY"] = "test-key"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# In-memory SQLite test engine — created once per process.
# ---------------------------------------------------------------------------

_TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
)
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)

# ---------------------------------------------------------------------------
# Patch app.database BEFORE importing app.main so that main.py's local
# `from app.database import SessionLocal` binding is the SQLite factory.
# ---------------------------------------------------------------------------

import app.database as _db_module  # noqa: E402  (import after env setup)

_db_module.engine = _TEST_ENGINE
_db_module.SessionLocal = _TestSessionLocal

# Now it's safe to import the FastAPI app and the rest of the app.
from app.main import app  # noqa: E402
from app.database import Base, seed_defaults  # noqa: E402
from app.dependencies import get_db  # noqa: E402

# ---------------------------------------------------------------------------
# Public constants for use in test modules.
# ---------------------------------------------------------------------------

API_KEY = "test-key"
AUTH_HEADERS = {"X-API-Key": API_KEY}

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_db():
    """
    Create all tables, seed default rows, yield to the test, then drop
    everything.  Autouse ensures every test starts with a clean, seeded DB.
    """
    Base.metadata.create_all(bind=_TEST_ENGINE)
    session = _TestSessionLocal()
    try:
        seed_defaults(session)
    finally:
        session.close()
    yield
    Base.metadata.drop_all(bind=_TEST_ENGINE)


@pytest.fixture
def db():
    """Yield a raw SQLAlchemy session for direct DB assertions."""
    session = _TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """
    Yield a FastAPI TestClient wired to the SQLite test database.
    The `get_db` dependency is overridden so every request handler sees the
    in-memory SQLite session instead of the production MySQL session.
    """

    def override_get_db():
        session = _TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
