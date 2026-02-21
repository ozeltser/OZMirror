from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Layout models
# ---------------------------------------------------------------------------

class GridItem(BaseModel):
    """Single item in a react-grid-layout grid array."""
    model_config = ConfigDict(extra="forbid")

    i: str
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
    moduleConfigs: Dict[str, ModuleInstanceConfig]


class LayoutData(BaseModel):
    """Root layout document."""
    model_config = ConfigDict(extra="forbid")

    activeProfile: str = "default"
    layouts: Dict[str, LayoutProfile]


# ---------------------------------------------------------------------------
# Layout request bodies
# ---------------------------------------------------------------------------

class UpdateLayoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profileName: str
    grid: List[GridItem]
    moduleConfigs: Dict[str, ModuleInstanceConfig]


class CreateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    copyFrom: str = "default"


class SetActiveProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")


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
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    serviceUrl: str
    manifest: ModuleManifest
    status: str = "online"


class RegisteredModule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    serviceUrl: str
    manifest: ModuleManifest
    status: str = "online"


class UpdateInstanceConfigRequest(BaseModel):
    """extra="allow" so arbitrary module config keys pass through opaquely."""
    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# Settings and themes
# ---------------------------------------------------------------------------

class GlobalSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: str = "dark"
    kiosk: bool = False
    cursorTimeout: int = 3000
    fontScale: float = 1.0
    autoStart: bool = False


class Theme(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    variables: Dict[str, str]


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
