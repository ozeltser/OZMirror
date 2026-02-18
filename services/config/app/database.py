from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

from sqlalchemy import Boolean, Column, Float, Integer, JSON, String, create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.models import (
    GlobalSettings,
    LayoutData,
    LayoutProfile,
    RegisteredModule,
    Theme,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Built-in seed data
# ---------------------------------------------------------------------------

_BUILTIN_THEMES: List[Dict] = [
    {
        "id": "dark",
        "name": "Dark",
        "variables": {
            "--color-bg": "#0d0d0d",
            "--color-surface": "#1a1a1a",
            "--color-accent": "#4fc3f7",
            "--color-text": "#e0e0e0",
            "--color-text-secondary": "#9e9e9e",
            "--color-border": "#2a2a2a",
            "--font-base": "'Inter', sans-serif",
        },
    },
    {
        "id": "light",
        "name": "Light",
        "variables": {
            "--color-bg": "#f5f5f5",
            "--color-surface": "#ffffff",
            "--color-accent": "#0288d1",
            "--color-text": "#212121",
            "--color-text-secondary": "#616161",
            "--color-border": "#e0e0e0",
            "--font-base": "'Inter', sans-serif",
        },
    },
    {
        "id": "amoled",
        "name": "AMOLED",
        "variables": {
            "--color-bg": "#000000",
            "--color-surface": "#0a0a0a",
            "--color-accent": "#00e5ff",
            "--color-text": "#e0e8f0",
            "--color-text-secondary": "#78909c",
            "--color-border": "#111111",
            "--font-base": "'Space Mono', monospace",
        },
    },
]

_DEFAULT_LAYOUT_PROFILES: Dict = {
    "default": {
        "grid": [{"i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3}],
        "moduleConfigs": {
            "clock_01": {
                "moduleId": "clock",
                "config": {
                    "format": "HH:mm:ss",
                    "timezone": "UTC",
                    "showDate": True,
                },
            }
        },
    }
}


# ---------------------------------------------------------------------------
# SQLAlchemy engine and session factory
# ---------------------------------------------------------------------------

def _build_database_url() -> URL:
    """Build a SQLAlchemy URL using URL.create() to safely handle special characters in passwords."""
    return URL.create(
        drivername="mysql+pymysql",
        username=os.getenv("MYSQL_USER", "ozmirror"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        host=os.getenv("MYSQL_HOST", "mysql"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        database=os.getenv("MYSQL_DATABASE", "ozmirror"),
    )


engine = create_engine(
    _build_database_url(),
    pool_pre_ping=True,     # Detect stale connections before use
    pool_recycle=3600,      # Recycle connections after 1 hour (within MySQL's wait_timeout)
    echo=os.getenv("LOG_LEVEL", "info").lower() == "debug",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# ORM table definitions
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class LayoutDataRow(Base):
    """
    Single-row table (always id=1).
    Stores the active profile name and all profiles as a MySQL JSON column.
    """
    __tablename__ = "layout_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    active_profile = Column(String(100), nullable=False, default="default")
    profiles = Column(JSON, nullable=False)


class ModuleRow(Base):
    """One row per registered module."""
    __tablename__ = "modules"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    service_url = Column(String(500), nullable=False)
    manifest = Column(JSON, nullable=False)
    status = Column(String(50), nullable=False, default="online")


class SettingsRow(Base):
    """Single-row table (always id=1)."""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    theme = Column(String(100), nullable=False, default="dark")
    kiosk = Column(Boolean, nullable=False, default=False)
    cursor_timeout = Column(Integer, nullable=False, default=3000)
    font_scale = Column(Float, nullable=False, default=1.0)
    auto_start = Column(Boolean, nullable=False, default=False)


class ThemeRow(Base):
    """One row per theme."""
    __tablename__ = "themes"

    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    variables = Column(JSON, nullable=False)


# ---------------------------------------------------------------------------
# Table creation and seeding (called from lifespan in main.py)
# ---------------------------------------------------------------------------

def create_tables() -> None:
    """Create all tables if they do not exist. Idempotent."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created")


def seed_defaults(db: Session) -> None:
    """
    Insert default rows into single-row tables if empty.
    Insert built-in themes if the themes table is empty.
    Safe to call on every startup — all checks are idempotent.
    """
    if db.query(SettingsRow).count() == 0:
        logger.info("Seeding default settings row")
        db.add(SettingsRow(
            id=1,
            theme="dark",
            kiosk=False,
            cursor_timeout=3000,
            font_scale=1.0,
            auto_start=False,
        ))
        db.commit()

    if db.query(LayoutDataRow).count() == 0:
        logger.info("Seeding default layout row")
        db.add(LayoutDataRow(
            id=1,
            active_profile="default",
            profiles=_DEFAULT_LAYOUT_PROFILES,
        ))
        db.commit()

    if db.query(ThemeRow).count() == 0:
        logger.info("Seeding built-in themes")
        for t in _BUILTIN_THEMES:
            db.add(ThemeRow(id=t["id"], name=t["name"], variables=t["variables"]))
        db.commit()


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------

# -- Layout --

def get_layout(db: Session) -> LayoutData:
    row = db.query(LayoutDataRow).filter(LayoutDataRow.id == 1).one()
    return LayoutData(
        activeProfile=row.active_profile,
        layouts={
            name: LayoutProfile(**profile)
            for name, profile in row.profiles.items()
        },
    )


def save_layout(db: Session, layout: LayoutData) -> None:
    row = db.query(LayoutDataRow).filter(LayoutDataRow.id == 1).one()
    row.active_profile = layout.activeProfile
    row.profiles = {
        name: profile.model_dump()
        for name, profile in layout.layouts.items()
    }
    db.commit()


def get_profiles(db: Session) -> List[str]:
    row = db.query(LayoutDataRow).filter(LayoutDataRow.id == 1).one()
    return list(row.profiles.keys())


def create_profile(db: Session, name: str, copy_from: str) -> None:
    layout = get_layout(db)
    source = layout.layouts[copy_from]
    layout.layouts[name] = LayoutProfile(**source.model_dump())
    save_layout(db, layout)


def delete_profile(db: Session, name: str) -> None:
    layout = get_layout(db)
    del layout.layouts[name]
    if layout.activeProfile == name:
        layout.activeProfile = "default"
    save_layout(db, layout)


def upsert_profile_content(db: Session, profile_name: str, profile: LayoutProfile) -> None:
    layout = get_layout(db)
    layout.layouts[profile_name] = profile
    save_layout(db, layout)


# -- Module instance config (lives inside the active layout profile) --

def get_instance_config(db: Session, module_id: str, instance_id: str) -> Optional[Dict]:
    layout = get_layout(db)
    profile = layout.layouts.get(layout.activeProfile)
    if profile is None:
        return None
    entry = profile.moduleConfigs.get(instance_id)
    if entry is None:
        # Fall back to manifest defaultConfig
        mod = get_module(db, module_id)
        if mod:
            return mod.manifest.defaultConfig
        return None
    return entry.config


def set_instance_config(db: Session, instance_id: str, config: Dict) -> bool:
    """Returns False if instance_id is not in the active profile."""
    layout = get_layout(db)
    profile = layout.layouts.get(layout.activeProfile)
    if profile is None or instance_id not in profile.moduleConfigs:
        return False
    profile.moduleConfigs[instance_id].config = config
    save_layout(db, layout)
    return True


# -- Module registry --

def get_modules(db: Session) -> List[RegisteredModule]:
    rows = db.query(ModuleRow).all()
    return [
        RegisteredModule(
            id=r.id,
            name=r.name,
            serviceUrl=r.service_url,
            manifest=r.manifest,
            status=r.status,
        )
        for r in rows
    ]


def get_module(db: Session, module_id: str) -> Optional[RegisteredModule]:
    row = db.query(ModuleRow).filter(ModuleRow.id == module_id).first()
    if row is None:
        return None
    return RegisteredModule(
        id=row.id,
        name=row.name,
        serviceUrl=row.service_url,
        manifest=row.manifest,
        status=row.status,
    )


def register_module(db: Session, module: RegisteredModule) -> None:
    existing = db.query(ModuleRow).filter(ModuleRow.id == module.id).first()
    if existing:
        existing.name = module.name
        existing.service_url = module.serviceUrl
        existing.manifest = module.manifest.model_dump()
        existing.status = module.status
    else:
        db.add(ModuleRow(
            id=module.id,
            name=module.name,
            service_url=module.serviceUrl,
            manifest=module.manifest.model_dump(),
            status=module.status,
        ))
    db.commit()


# -- Settings --

def get_settings(db: Session) -> GlobalSettings:
    row = db.query(SettingsRow).filter(SettingsRow.id == 1).one()
    return GlobalSettings(
        theme=row.theme,
        kiosk=row.kiosk,
        cursorTimeout=row.cursor_timeout,
        fontScale=row.font_scale,
        autoStart=row.auto_start,
    )


def save_settings(db: Session, settings: GlobalSettings) -> None:
    row = db.query(SettingsRow).filter(SettingsRow.id == 1).one()
    row.theme = settings.theme
    row.kiosk = settings.kiosk
    row.cursor_timeout = settings.cursorTimeout
    row.font_scale = settings.fontScale
    row.auto_start = settings.autoStart
    db.commit()


# -- Themes --

def get_themes(db: Session) -> List[Theme]:
    rows = db.query(ThemeRow).all()
    return [Theme(id=r.id, name=r.name, variables=r.variables) for r in rows]


def upsert_theme(db: Session, theme: Theme) -> None:
    existing = db.query(ThemeRow).filter(ThemeRow.id == theme.id).first()
    if existing:
        existing.name = theme.name
        existing.variables = theme.variables
    else:
        db.add(ThemeRow(id=theme.id, name=theme.name, variables=theme.variables))
    db.commit()
