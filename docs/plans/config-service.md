> **SUPERSEDED** — This document described a JSON-file storage approach (`JSONDatabase` with `fcntl` locking and `os.replace()`) that was replaced before any code was written. The current implementation uses MySQL 8.0 via SQLAlchemy ORM + PyMySQL. See the approved plan at `C:\Users\ozlis\.claude\plans\indexed-plotting-willow.md` and the implemented source files in `services/config/app/`.

# Config Service Implementation Plan (JSON Storage — SUPERSEDED)

**Phase**: 1 (Days 4-5, from Infrastructure Setup)
**Status**: Ready to Implement
**Dependencies**: Redis container running (Phase 1, Day 3 complete)

## Overview

The Config Service is the central dependency for the entire OzMirror system. Every module registers with it on startup, and the UI reads layout, settings, and theme data from it. Nothing else can start until this service is healthy.

**What this plan creates** — all new source files inside `services/config/app/`:

```
services/config/app/
├── __init__.py
├── main.py
├── models.py
├── database.py
├── dependencies.py
└── routes/
    ├── __init__.py
    ├── layout.py
    ├── modules.py
    └── settings.py
```

**Already exists — do NOT recreate or modify**:
- `services/config/Dockerfile`
- `services/config/requirements.txt`

---

## Design Decisions

Before writing any code, understand these decisions so you do not accidentally deviate from them.

**1. `fcntl` file locking (Linux-only)**
The container runs `python:3.11-slim` (Linux). `fcntl.flock()` is used for exclusive file locks. This is correct and intentional — do not attempt to use cross-platform alternatives like `filelock`. Each lock uses a companion `.lock` file (e.g., `layouts.json.lock`) rather than locking the data file itself, so reads and writes on the data file are always clean.

**2. Atomic writes via write-then-replace**
All JSON writes follow the pattern: write to `filename.tmp`, then `os.replace(filename.tmp, filename)`. `os.replace()` is atomic on Linux (single filesystem). This prevents a crash mid-write from producing a truncated or corrupt data file.

**3. API key auth with `secrets.compare_digest()`**
The standard `==` string comparison is vulnerable to timing attacks. `secrets.compare_digest()` runs in constant time regardless of where strings differ. This is mandatory on all write endpoints.

**4. No `pydantic-settings`**
`pydantic-settings` is in `requirements.txt` but is not used. All environment variables are read with `os.getenv()`. This keeps the configuration surface simple for the MVP.

**5. Global `db` instance**
`database.py` creates one `JSONDatabase` instance at module load time. All route files import this instance directly. FastAPI's async event loop runs in a single thread per worker (uvicorn default: 1 worker), so there is no shared-state race condition from the global. The file lock handles any remaining concurrency from the OS level.

**6. Module offline status on restart**
The config service does NOT track heartbeats. When a module container restarts, it re-registers itself with `status: "online"`. The config service simply accepts the registration and overwrites the previous record. Modules that have not re-registered remain in `modules.json` with their last-known status — the UI is responsible for interpreting `offline` status.

**7. Themes stored in `themes.json`**
Three built-in themes (dark, light, amoled) are seeded into `themes.json` on first run if the file does not exist. The `POST /api/config/themes` endpoint upserts by `id`.

**8. `routes/__init__.py`**
Empty file. Its only purpose is to make `routes/` a Python package so `from app.routes import layout` works.

**9. `app/__init__.py`**
Contains only `__version__ = "1.0.0"`. Nothing else.

**10. Extra fields rejected**
All Pydantic models use `model_config = ConfigDict(extra="forbid")`. Any request body with unknown fields returns HTTP 422. This prevents clients from silently storing data the service does not understand. The single exception is `UpdateInstanceConfigRequest`, which uses `extra="allow"` because module instance configs are freeform blobs — the config service stores them opaquely.

---

## File 1: `services/config/app/__init__.py`

```python
__version__ = "1.0.0"
```

---

## File 2: `services/config/app/models.py`

```python
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Layout models
# ---------------------------------------------------------------------------

class GridItem(BaseModel):
    """Single item in a react-grid-layout grid array."""
    model_config = ConfigDict(extra="forbid")

    i: str          # instance ID, e.g. "clock_01"
    x: int
    y: int
    w: int
    h: int
    minW: Optional[int] = None
    minH: Optional[int] = None
    maxW: Optional[int] = None
    maxH: Optional[int] = None


class ModuleInstanceConfig(BaseModel):
    """Config stored per module instance inside a layout profile."""
    model_config = ConfigDict(extra="forbid")

    moduleId: str
    config: Dict[str, Any] = Field(default_factory=dict)


class LayoutProfile(BaseModel):
    """One named layout profile."""
    model_config = ConfigDict(extra="forbid")

    grid: List[GridItem]
    moduleConfigs: Dict[str, ModuleInstanceConfig]  # instanceId -> config


class LayoutData(BaseModel):
    """Root layout document stored in layouts.json."""
    model_config = ConfigDict(extra="forbid")

    activeProfile: str = "default"
    layouts: Dict[str, LayoutProfile]  # profileName -> LayoutProfile


# ---------------------------------------------------------------------------
# Layout request bodies
# ---------------------------------------------------------------------------

class UpdateLayoutRequest(BaseModel):
    """Body for PUT /api/config/layout."""
    model_config = ConfigDict(extra="forbid")

    profileName: str
    grid: List[GridItem]
    moduleConfigs: Dict[str, ModuleInstanceConfig]


class CreateProfileRequest(BaseModel):
    """Body for POST /api/config/layout/profiles."""
    model_config = ConfigDict(extra="forbid")

    name: str
    copyFrom: str = "default"


# ---------------------------------------------------------------------------
# Module registry models
# ---------------------------------------------------------------------------

class GridConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minW: Optional[int] = None
    minH: Optional[int] = None
    maxW: Optional[int] = None
    maxH: Optional[int] = None
    defaultW: Optional[int] = None
    defaultH: Optional[int] = None


class ModuleManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str = ""
    version: str
    author: str = ""
    icon: Optional[str] = None
    defaultConfig: Dict[str, Any] = Field(default_factory=dict)
    configSchema: Optional[Dict[str, Any]] = None
    gridConstraints: Optional[GridConstraints] = None


class RegisterModuleRequest(BaseModel):
    """Body for POST /api/config/modules/register."""
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    serviceUrl: str
    manifest: ModuleManifest
    status: str = "online"


class RegisteredModule(BaseModel):
    """Full module record as stored in modules.json."""
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    serviceUrl: str
    manifest: ModuleManifest
    status: str = "online"


class UpdateInstanceConfigRequest(BaseModel):
    """Body for PUT /api/config/modules/:id/config/:instanceId.

    Uses extra="allow" so arbitrary module config keys pass through without
    requiring the config service to know each module's schema. The module
    itself validates its own config structure.
    """
    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# Settings and themes
# ---------------------------------------------------------------------------

class GlobalSettings(BaseModel):
    """Document stored in settings.json."""
    model_config = ConfigDict(extra="forbid")

    theme: str = "dark"
    kiosk: bool = False
    cursorTimeout: int = 3000
    fontScale: float = 1.0
    autoStart: bool = False


class Theme(BaseModel):
    """A single theme document stored in themes.json."""
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    variables: Dict[str, str]  # CSS variable name -> value


# ---------------------------------------------------------------------------
# Infrastructure responses
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    version: str
    uptime: float


class SuccessResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
```

**Key decisions:**
- `GridItem` optional fields (`minW`, `minH`, etc.) are stored as-is so the UI can round-trip react-grid-layout's full item format without data loss.
- `LayoutData` and `UpdateLayoutRequest` are separate models. The PUT endpoint takes a single profile's content and the service merges it into the full `LayoutData` document. This prevents a client from accidentally overwriting unrelated profiles.
- `UpdateInstanceConfigRequest` is the only model with `extra="allow"` — module configs are freeform blobs the config service stores opaquely.

---

## File 3: `services/config/app/database.py`

```python
from __future__ import annotations

import fcntl
import json
import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, List, Optional

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

_DEFAULT_LAYOUT: Dict = {
    "activeProfile": "default",
    "layouts": {
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
    },
}

_DEFAULT_SETTINGS: Dict = {
    "theme": "dark",
    "kiosk": False,
    "cursorTimeout": 3000,
    "fontScale": 1.0,
    "autoStart": False,
}


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class JSONDatabase:
    """
    JSON-file storage with exclusive file locking and atomic writes.

    Each data file has a companion .lock file used for locking so the data
    file itself is never held open while the lock is acquired. Writes use a
    .tmp intermediate file and os.replace() for atomicity.
    """

    def __init__(self, data_dir: str = "/app/data") -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self._layouts_path = self.data_dir / "layouts.json"
        self._modules_path = self.data_dir / "modules.json"
        self._settings_path = self.data_dir / "settings.json"
        self._themes_path = self.data_dir / "themes.json"

        self._seed_defaults()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @contextmanager
    def _locked(self, file_path: Path):
        """Acquire an exclusive fcntl lock on file_path's companion .lock file."""
        lock_path = file_path.with_suffix(".lock")
        # Open in 'a' so it creates if absent, never truncates content.
        with open(lock_path, "a") as lock_fd:
            try:
                fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)
                yield
            finally:
                fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)

    def _read(self, file_path: Path) -> Dict:
        with self._locked(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)

    def _write(self, file_path: Path, data: Dict) -> None:
        """Write data atomically: tmp file + os.replace()."""
        tmp_path = file_path.with_suffix(".tmp")
        with self._locked(file_path):
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, file_path)

    def _seed_defaults(self) -> None:
        if not self._layouts_path.exists():
            logger.info("Seeding default layout data")
            self._write(self._layouts_path, _DEFAULT_LAYOUT)

        if not self._modules_path.exists():
            logger.info("Seeding empty module registry")
            self._write(self._modules_path, {"modules": []})

        if not self._settings_path.exists():
            logger.info("Seeding default settings")
            self._write(self._settings_path, _DEFAULT_SETTINGS)

        if not self._themes_path.exists():
            logger.info("Seeding built-in themes")
            self._write(self._themes_path, {"themes": _BUILTIN_THEMES})

    # ------------------------------------------------------------------
    # Layout
    # ------------------------------------------------------------------

    def get_layout(self) -> LayoutData:
        return LayoutData(**self._read(self._layouts_path))

    def save_layout(self, layout: LayoutData) -> None:
        self._write(self._layouts_path, layout.model_dump())

    def get_profiles(self) -> List[str]:
        data = self._read(self._layouts_path)
        return list(data.get("layouts", {}).keys())

    def create_profile(self, name: str, copy_from: str) -> None:
        layout = self.get_layout()
        source = layout.layouts[copy_from]
        # Deep copy via serialise/deserialise so no shared object references.
        layout.layouts[name] = LayoutProfile(**source.model_dump())
        self.save_layout(layout)

    def delete_profile(self, name: str) -> None:
        layout = self.get_layout()
        del layout.layouts[name]
        if layout.activeProfile == name:
            layout.activeProfile = "default"
        self.save_layout(layout)

    def upsert_profile_content(self, profile_name: str, profile: LayoutProfile) -> None:
        layout = self.get_layout()
        layout.layouts[profile_name] = profile
        self.save_layout(layout)

    # ------------------------------------------------------------------
    # Module instance config (stored inside layout profiles)
    # ------------------------------------------------------------------

    def get_instance_config(self, module_id: str, instance_id: str) -> Optional[Dict]:
        layout = self.get_layout()
        profile = layout.layouts.get(layout.activeProfile)
        if profile is None:
            return None
        entry = profile.moduleConfigs.get(instance_id)
        if entry is None:
            # Fall back to manifest defaultConfig
            mod = self.get_module(module_id)
            if mod:
                return mod.manifest.defaultConfig
            return None
        return entry.config

    def set_instance_config(self, instance_id: str, config: Dict) -> bool:
        """Returns False if instance_id is not found in the active profile."""
        layout = self.get_layout()
        profile = layout.layouts.get(layout.activeProfile)
        if profile is None or instance_id not in profile.moduleConfigs:
            return False
        profile.moduleConfigs[instance_id].config = config
        self.save_layout(layout)
        return True

    # ------------------------------------------------------------------
    # Module registry
    # ------------------------------------------------------------------

    def get_modules(self) -> List[RegisteredModule]:
        data = self._read(self._modules_path)
        return [RegisteredModule(**m) for m in data.get("modules", [])]

    def get_module(self, module_id: str) -> Optional[RegisteredModule]:
        for mod in self.get_modules():
            if mod.id == module_id:
                return mod
        return None

    def register_module(self, module: RegisteredModule) -> None:
        data = self._read(self._modules_path)
        modules = [m for m in data.get("modules", []) if m.get("id") != module.id]
        modules.append(module.model_dump())
        self._write(self._modules_path, {"modules": modules})

    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------

    def get_settings(self) -> GlobalSettings:
        return GlobalSettings(**self._read(self._settings_path))

    def save_settings(self, settings: GlobalSettings) -> None:
        self._write(self._settings_path, settings.model_dump())

    # ------------------------------------------------------------------
    # Themes
    # ------------------------------------------------------------------

    def get_themes(self) -> List[Theme]:
        data = self._read(self._themes_path)
        return [Theme(**t) for t in data.get("themes", [])]

    def upsert_theme(self, theme: Theme) -> None:
        data = self._read(self._themes_path)
        themes = [t for t in data.get("themes", []) if t.get("id") != theme.id]
        themes.append(theme.model_dump())
        self._write(self._themes_path, {"themes": themes})


# ---------------------------------------------------------------------------
# Global singleton — imported by routes
# ---------------------------------------------------------------------------

db = JSONDatabase(os.getenv("CONFIG_DATA_DIR", "/app/data"))
```

**Key decisions:**
- The lock is taken on a `.lock` file, not the data file itself. This means `os.replace()` can swap the inode cleanly without conflicting with an open file descriptor.
- `os.fsync()` is called before `os.replace()`. On a Raspberry Pi with an SD card, this prevents a power-loss scenario from leaving a zero-byte `.tmp` file.
- `get_instance_config` returns the manifest `defaultConfig` as a fallback when no saved instance config exists, so a freshly-registered module still returns useful data.
- `set_instance_config` returns `bool` so the route layer can return 404 without raising from inside the database layer.

---

## File 4: `services/config/app/dependencies.py`

```python
from __future__ import annotations

import logging
import os
import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

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
        # Fail closed: if no API_KEY is configured, reject all writes.
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
```

**Key decisions:**
- `auto_error=False` on `APIKeyHeader` so FastAPI does not generate its own 403 before our dependency runs. This lets us return a consistent 401 with the correct `WWW-Authenticate` header and log the failure ourselves.
- If `API_KEY` is unset, the service returns 500 rather than silently accepting all requests. Fail-closed is always safer than fail-open.
- The submitted key is never logged, not even at DEBUG level.

---

## File 5: `services/config/app/routes/__init__.py`

```python
```

(Empty file — makes `routes/` a Python package.)

---

## File 6: `services/config/app/routes/layout.py`

```python
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.dependencies import require_api_key
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
async def get_layout() -> LayoutData:
    """Return the full layout document (all profiles, active profile name)."""
    return db.get_layout()


@router.put("", response_model=SuccessResponse, dependencies=[Depends(require_api_key)])
async def update_layout(body: UpdateLayoutRequest) -> SuccessResponse:
    """
    Save a profile's grid and moduleConfigs.

    The profile named in `body.profileName` is upserted into the layout
    document. Other profiles are not modified.
    """
    profile = LayoutProfile(grid=body.grid, moduleConfigs=body.moduleConfigs)
    db.upsert_profile_content(body.profileName, profile)
    logger.info("Layout profile '%s' updated", body.profileName)
    return SuccessResponse()


@router.get("/profiles", response_model=List[str])
async def list_profiles() -> List[str]:
    """Return names of all saved layout profiles."""
    return db.get_profiles()


@router.post(
    "/profiles",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
async def create_profile(body: CreateProfileRequest) -> SuccessResponse:
    """
    Create a new profile, optionally cloning an existing one.

    Returns 409 if the name is already taken, 404 if `copyFrom` does not exist.
    """
    profiles = db.get_profiles()

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

    db.create_profile(body.name, body.copyFrom)
    logger.info("Created layout profile '%s' (copied from '%s')", body.name, body.copyFrom)
    return SuccessResponse()


@router.delete(
    "/profiles/{name}",
    response_model=SuccessResponse,
    dependencies=[Depends(require_api_key)],
)
async def delete_profile(name: str) -> SuccessResponse:
    """
    Delete a layout profile.

    The "default" profile cannot be deleted. If the deleted profile was active,
    the active profile is reset to "default".
    """
    if name == "default":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'default' profile cannot be deleted",
        )

    profiles = db.get_profiles()
    if name not in profiles:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile '{name}' not found",
        )

    db.delete_profile(name)
    logger.info("Deleted layout profile '%s'", name)
    return SuccessResponse()
```

---

## File 7: `services/config/app/routes/modules.py`

```python
from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.dependencies import require_api_key
from app.models import (
    RegisteredModule,
    RegisterModuleRequest,
    SuccessResponse,
    UpdateInstanceConfigRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config/modules", tags=["modules"])


@router.get("", response_model=List[RegisteredModule])
async def list_modules() -> List[RegisteredModule]:
    """Return all registered modules."""
    return db.get_modules()


@router.get("/{module_id}", response_model=RegisteredModule)
async def get_module(module_id: str) -> RegisteredModule:
    """Return a specific registered module by ID."""
    mod = db.get_module(module_id)
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
async def register_module(body: RegisterModuleRequest) -> SuccessResponse:
    """
    Register or update a module in the registry.

    Modules call this on container startup. If the module was already registered
    (e.g. after a restart), the record is replaced in full.
    """
    module = RegisteredModule(**body.model_dump())
    db.register_module(module)
    logger.info("Module '%s' registered from %s", module.id, module.serviceUrl)
    return SuccessResponse()


@router.get(
    "/{module_id}/config/{instance_id}",
    response_model=Dict[str, Any],
)
async def get_instance_config(module_id: str, instance_id: str) -> Dict[str, Any]:
    """
    Return the saved config for one module instance.

    Falls back to the module's manifest `defaultConfig` if no saved config
    exists for this instance. Returns 404 only if neither a saved config
    nor a registered module can be found.
    """
    config = db.get_instance_config(module_id, instance_id)
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
) -> SuccessResponse:
    """
    Replace the config for a module instance in the active layout profile.

    Returns 404 if `instance_id` does not exist in the active profile's
    moduleConfigs. The client should PUT the full config object, not a patch.
    """
    # model_dump() with extra="allow" returns all fields including unknown ones.
    config_data = body.model_dump()
    saved = db.set_instance_config(instance_id, config_data)
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found in active layout profile",
        )
    logger.info(
        "Updated instance config: module='%s' instance='%s'", module_id, instance_id
    )
    return SuccessResponse()
```

---

## File 8: `services/config/app/routes/settings.py`

```python
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, status

from app.database import db
from app.dependencies import require_api_key
from app.models import GlobalSettings, SuccessResponse, Theme

logger = logging.getLogger(__name__)

# No prefix — settings and themes are at different top-level paths.
router = APIRouter(tags=["settings"])


# ---------------------------------------------------------------------------
# Global settings
# ---------------------------------------------------------------------------

@router.get("/api/config/settings", response_model=GlobalSettings)
async def get_settings() -> GlobalSettings:
    """Return global application settings."""
    return db.get_settings()


@router.put(
    "/api/config/settings",
    response_model=SuccessResponse,
    dependencies=[Depends(require_api_key)],
)
async def update_settings(body: GlobalSettings) -> SuccessResponse:
    """Replace global settings. All fields are required."""
    db.save_settings(body)
    logger.info("Global settings updated: theme='%s' kiosk=%s", body.theme, body.kiosk)
    return SuccessResponse()


# ---------------------------------------------------------------------------
# Themes
# ---------------------------------------------------------------------------

@router.get("/api/config/themes", response_model=List[Theme])
async def list_themes() -> List[Theme]:
    """Return all themes (built-in and custom)."""
    return db.get_themes()


@router.post(
    "/api/config/themes",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
async def upsert_theme(body: Theme) -> SuccessResponse:
    """
    Add a new theme or update an existing one by ID.

    Built-in themes (dark, light, amoled) can be overridden this way.
    """
    db.upsert_theme(body)
    logger.info("Theme upserted: id='%s'", body.id)
    return SuccessResponse()
```

**Note on prefix:** `settings.py` does not use `APIRouter(prefix=...)` because the settings and themes endpoints sit at different top-level paths (`/api/config/settings` vs `/api/config/themes`). The full paths are declared inline on each route.

---

## File 9: `services/config/app/main.py`

```python
from __future__ import annotations

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
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
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="OzMirror Configuration Service",
    description="Central configuration store for OzMirror — layouts, modules, settings, themes.",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
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
    allow_credentials=False,   # API key auth — no cookies needed
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
```

**Key decisions:**
- `time.monotonic()` for uptime — never goes backwards on NTP adjustments, so the value is always non-negative and increasing.
- The global `Exception` handler returns a generic 500 message. Stack traces are only in logs (server-side), never in HTTP responses.
- `allow_credentials=False` because the service uses API keys in headers, not cookies or sessions.
- `ALLOWED_ORIGINS` parsing strips whitespace from each item and skips empty strings, tolerating values like `"http://localhost, http://192.168.1.10"` with spaces after commas.
- The `API_KEY` environment variable is never referenced or logged in `main.py`. It is read only inside `dependencies.py`.

---

## Verification: Curl Test Suite

Run after `docker-compose up -d redis config-service`. Replace `YOUR_API_KEY` with the value from your `.env` file.

```bash
# 1. Health and root
curl -s http://localhost:8000/health | python3 -m json.tool
# Expected: {"status": "healthy", "version": "1.0.0", "uptime": <float>}

curl -s http://localhost:8000/ | python3 -m json.tool
# Expected: {"service": "OzMirror Configuration Service", ...}

# 2. Layout — public reads
curl -s http://localhost:8000/api/config/layout | python3 -m json.tool
# Expected: {"activeProfile": "default", "layouts": {"default": {...}}}

curl -s http://localhost:8000/api/config/layout/profiles | python3 -m json.tool
# Expected: ["default"]

# 3. Layout — authenticated writes
curl -s -X PUT http://localhost:8000/api/config/layout \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "profileName": "default",
    "grid": [{"i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3}],
    "moduleConfigs": {
      "clock_01": {
        "moduleId": "clock",
        "config": {"format": "HH:mm:ss", "timezone": "UTC", "showDate": true}
      }
    }
  }' | python3 -m json.tool
# Expected: {"success": true}

curl -s -X POST http://localhost:8000/api/config/layout/profiles \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"name": "night", "copyFrom": "default"}' | python3 -m json.tool
# Expected: {"success": true}

curl -s http://localhost:8000/api/config/layout/profiles | python3 -m json.tool
# Expected: ["default", "night"]

curl -s -X DELETE http://localhost:8000/api/config/layout/profiles/night \
  -H "X-API-Key: YOUR_API_KEY" | python3 -m json.tool
# Expected: {"success": true}

# Attempt to delete default — must fail with 400
curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE http://localhost:8000/api/config/layout/profiles/default \
  -H "X-API-Key: YOUR_API_KEY"
# Expected: 400

# 4. Module registry
curl -s http://localhost:8000/api/config/modules | python3 -m json.tool
# Expected: [] on fresh start

curl -s -X POST http://localhost:8000/api/config/modules/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "id": "clock",
    "name": "Clock",
    "serviceUrl": "http://clock-service:3001",
    "manifest": {
      "id": "clock",
      "name": "Clock",
      "description": "Digital clock",
      "version": "1.0.0",
      "author": "OzMirror",
      "defaultConfig": {"format": "HH:mm:ss", "timezone": "UTC", "showDate": true}
    },
    "status": "online"
  }' | python3 -m json.tool
# Expected: {"success": true}

curl -s http://localhost:8000/api/config/modules/clock | python3 -m json.tool
# Expected: full module record

curl -s http://localhost:8000/api/config/modules/clock/config/clock_01 | python3 -m json.tool
# Expected: {"format": "HH:mm:ss", "timezone": "UTC", "showDate": true}

curl -s -X PUT http://localhost:8000/api/config/modules/clock/config/clock_01 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"format": "HH:mm", "timezone": "America/New_York", "showDate": false}' \
  | python3 -m json.tool
# Expected: {"success": true}

# 5. Settings
curl -s http://localhost:8000/api/config/settings | python3 -m json.tool
# Expected: {"theme": "dark", "kiosk": false, "cursorTimeout": 3000, ...}

curl -s -X PUT http://localhost:8000/api/config/settings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"theme": "amoled", "kiosk": true, "cursorTimeout": 5000, "fontScale": 1.2, "autoStart": true}' \
  | python3 -m json.tool
# Expected: {"success": true}

curl -s http://localhost:8000/api/config/settings | python3 -m json.tool
# Expected: theme=amoled, kiosk=true

# 6. Themes
curl -s http://localhost:8000/api/config/themes | python3 -m json.tool
# Expected: 3 themes: dark, light, amoled

curl -s -X POST http://localhost:8000/api/config/themes \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "id": "ocean",
    "name": "Ocean",
    "variables": {
      "--color-bg": "#0a1929",
      "--color-surface": "#0d2137",
      "--color-accent": "#29b6f6",
      "--color-text": "#e0f7fa",
      "--color-text-secondary": "#80cbc4",
      "--color-border": "#1a3a5c",
      "--font-base": "\"Roboto\", sans-serif"
    }
  }' | python3 -m json.tool
# Expected: {"success": true}

curl -s http://localhost:8000/api/config/themes | python3 -m json.tool
# Expected: 4 themes including "ocean"

# 7. Auth rejection tests
# Missing API key — must return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT http://localhost:8000/api/config/settings \
  -H "Content-Type: application/json" \
  -d '{"theme": "light", "kiosk": false, "cursorTimeout": 3000, "fontScale": 1.0, "autoStart": false}'
# Expected: 401

# Wrong API key — must return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT http://localhost:8000/api/config/settings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong_key" \
  -d '{"theme": "light", "kiosk": false, "cursorTimeout": 3000, "fontScale": 1.0, "autoStart": false}'
# Expected: 401

# Extra field on a strict model — must return 422
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT http://localhost:8000/api/config/settings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"theme": "light", "kiosk": false, "cursorTimeout": 3000, "fontScale": 1.0, "autoStart": false, "unknownField": "bad"}'
# Expected: 422

# 8. Persistence check — data survives container restart
docker-compose restart config-service
sleep 5
curl -s http://localhost:8000/api/config/settings | python3 -m json.tool
# Expected: theme=amoled (value from test 5 above)

# Verify JSON files and lock files in the data volume
docker-compose exec config-service ls -la /app/data/
# Expected: layouts.json, modules.json, settings.json, themes.json
#           + companion .lock files for each
```

---

## Security Checklist

Before marking this service complete, verify every item:

- [ ] `secrets.compare_digest()` used in `dependencies.py`, not `==`
- [ ] `API_KEY` is never logged anywhere — grep `app/` for `API_KEY`; it should only appear inside `os.getenv()` in `dependencies.py`
- [ ] `REDIS_PASSWORD` is not referenced anywhere in the config service code (the service does not connect to Redis)
- [ ] All write endpoints (`PUT`, `POST`, `DELETE`) have `dependencies=[Depends(require_api_key)]`
- [ ] All read endpoints (`GET`) have no auth dependency — intentional
- [ ] `ALLOWED_ORIGINS` does not contain `*` — validate your `.env` value
- [ ] Stack traces never appear in HTTP responses — the global exception handler returns only `{"detail": "An internal error occurred"}`
- [ ] All models except `UpdateInstanceConfigRequest` use `extra="forbid"` — confirmed by the 422 curl test above
- [ ] `.lock` files are created in `/app/data/` — check after first run
- [ ] No stale `.tmp` files in `/app/data/` after normal operation
- [ ] The `default` profile cannot be deleted — confirmed by the 400 curl test above

---

## What Comes Next

**Immediate next step**: Clock module (`docs/plans/03-clock-module.md`).

The clock module depends on the config service in two ways:

1. **On startup**, the clock container POSTs to `POST /api/config/modules/register` with its manifest, including `X-API-Key` in the request header.
2. **On data fetch**, the UI calls `GET /api/config/modules/clock/config/clock_01` to retrieve the current instance config before rendering the widget.

The clock module must handle the case where the config service is not yet healthy on startup (retry with exponential backoff). `docker-compose depends_on: condition: service_healthy` is a best-effort ordering, not a hard guarantee within the application startup sequence.

Every subsequent module follows the same self-registration pattern:

```
Module startup sequence:
  1. Retry GET /health until 200 (with backoff, max ~30s)
  2. POST /api/config/modules/register  (with X-API-Key header)
  3. Begin normal operation
```

---

## Files Created Summary

```
services/config/app/
├── __init__.py          ← __version__ = "1.0.0"
├── main.py              ← FastAPI app, CORS, routers, health, exception handler
├── models.py            ← All Pydantic models (extra="forbid" everywhere except UpdateInstanceConfigRequest)
├── database.py          ← JSONDatabase: fcntl locking, atomic writes, seed data, global db instance
├── dependencies.py      ← require_api_key with secrets.compare_digest()
└── routes/
    ├── __init__.py      ← empty
    ├── layout.py        ← GET/PUT layout; GET/POST/DELETE profiles
    ├── modules.py       ← GET modules; POST register; GET/PUT instance config
    └── settings.py      ← GET/PUT settings; GET/POST themes
```

**Previously existing (do not touch)**:
```
services/config/Dockerfile
services/config/requirements.txt
```

---

**Previous Plan**: [Infrastructure Setup](01-infrastructure-setup.md)
**Next Plan**: [Clock Module](03-clock-module.md)
