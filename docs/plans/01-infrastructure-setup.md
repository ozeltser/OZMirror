# Infrastructure Setup Plan

**Phase**: 0-1 (Days 1-7)
**Status**: Ready to Start
**Dependencies**: None

## Overview

This plan covers the foundation of the OzMirror system:
- **Phase 0** (Days 1-2): Project bootstrap, directory structure, base configurations
- **Phase 1** (Days 3-7): Core infrastructure services that all other components depend on

**What you'll build**:
- Complete project structure
- Redis message broker with pub/sub channels
- Configuration Service (FastAPI) with REST API
- WebSocket Bridge for real-time updates
- Nginx API Gateway for routing

**Outcome**: A working backend infrastructure ready for modules and UI.

---

## Phase 0: Bootstrap (Days 1-2)

### Day 1: Project Structure & Configuration Files

#### Step 1: Create Directory Structure (30 minutes)

Run these commands from your project root (`/path/to/OZMirror`):

```bash
# UI (React frontend)
mkdir -p ui/src/components ui/src/widgets ui/src/hooks ui/src/api ui/src/store ui/src/core ui/src/types
mkdir -p ui/public/themes

# Services
mkdir -p services/config/app/routes services/config/app/schemas services/config/data
mkdir -p services/websocket/src

# Modules (all 7)
mkdir -p modules/clock/src modules/clock/data
mkdir -p modules/weather/src modules/weather/data
mkdir -p modules/calendar/src modules/calendar/data
mkdir -p modules/rss/src modules/rss/data
mkdir -p modules/system_stats/src modules/system_stats/data
mkdir -p modules/now_playing/src modules/now_playing/data
mkdir -p modules/sticky_notes/src modules/sticky_notes/data

# Infrastructure
mkdir -p nginx/ssl

# Scripts & Docs
mkdir -p scripts docs/plans

# Verify structure
ls -la
```

**Expected output**: All directories created successfully.

#### Step 2: Create .gitignore (10 minutes)

Create `/path/to/OZMirror\.gitignore`:

```gitignore
# Dependencies
node_modules/
__pycache__/
*.pyc
.pytest_cache/
venv/
env/

# Build outputs
dist/
build/
*.egg-info/

# Docker
.docker/
docker-compose.override.yml

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# Data
services/config/data/*.json
modules/*/data/*.db
modules/*/data/*.sqlite

# SSL certificates (if self-generated)
nginx/ssl/*.key
nginx/ssl/*.crt

# Temporary files
*.tmp
.cache/
```

#### Step 3: Create .env.example (15 minutes)

Create `/path/to/OZMirror\.env.example`:

```bash
# ================================================
# OzMirror Environment Configuration
# ================================================
# Copy this file to .env and update with your values

# ----------------
# Redis
# ----------------
REDIS_URL=redis://redis:6379

# ----------------
# Configuration Service
# ----------------
CONFIG_SERVICE_URL=http://config-service:8000
# Use JSON files for MVP (simpler)
CONFIG_STORAGE_TYPE=json
CONFIG_DATA_DIR=/app/data

# For PostgreSQL (future):
# DATABASE_URL=postgresql://ozmirror:password@postgres:5432/ozmirror

# ----------------
# WebSocket Bridge
# ----------------
WEBSOCKET_PORT=8080

# ----------------
# Module API Keys
# ----------------
# Weather Module (OpenWeatherMap)
WEATHER_API_KEY=your_openweathermap_api_key_here

# Spotify (Now Playing Module)
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:80/callback

# Google Calendar (Calendar Module) - Optional
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# ----------------
# System
# ----------------
TZ=America/New_York
NODE_ENV=production
LOG_LEVEL=info
```

**Action**: Copy to `.env` and update values:
```bash
cp .env.example .env
```

#### Step 4: Create README.md (15 minutes)

Create `/path/to/OZMirror\README.md`:

```markdown
# OzMirror - Smart Display Platform

A distributed, microservices-based smart display application inspired by MagicMirror2.

## Features

- 🕐 **7 Bundled Modules**: Clock, Weather, Calendar, RSS, System Stats, Now Playing, Sticky Notes
- 🎨 **Drag & Drop Layout**: Customize your display with touch or mouse
- ⚡ **Real-time Updates**: WebSocket-powered live data
- 🎭 **Themeable UI**: Dark, Light, AMOLED themes + custom themes
- 🥧 **Raspberry Pi Ready**: Optimized for Pi 4 (4GB+)
- 🐳 **Docker-based**: Each module runs in its own container

## Architecture

```
Browser → Nginx → React UI
                ↓
         Config Service
                ↓
         Redis Pub/Sub ← → Module Containers
                ↓
         WebSocket Bridge
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (For Pi) Raspberry Pi 4 with 4GB+ RAM

### Installation

1. **Clone & Configure**:
   ```bash
   git clone <your-repo-url>
   cd OZMirror
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```

3. **Open in Browser**:
   ```
   http://localhost:80
   ```

### Development Mode

```bash
# Start with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Documentation

- [📐 Architecture](docs/ARCHITECTURE.md)
- [🔧 Module Development Guide](docs/MODULE_DEVELOPMENT.md)
- [📡 API Reference](docs/API.md)
- [🚀 Deployment Guide](docs/DEPLOYMENT.md)
- [📋 Implementation Plans](docs/plans/README.md)

## Project Status

**Current Phase**: Phase 0 - Bootstrap
**Version**: 0.1.0-dev

See [Implementation Plans](docs/plans/README.md) for detailed roadmap.

## Performance Targets

- Cold start: < 15 seconds
- UI load time: < 2 seconds
- Memory usage: < 1.5GB (5 modules)
- API response (P95): < 100ms

## License

GPL-3.0 License - See LICENSE file

## Credits

Inspired by [MagicMirror²](https://magicmirror.builders/)
```

---

### Day 2: Docker Configuration

#### Step 1: Create Base docker-compose.yml (1 hour)

Create `/path/to/OZMirror\docker-compose.yml`:

```yaml
version: '3.8'

services:
  # =====================================
  # API Gateway (Nginx)
  # =====================================
  gateway:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: ozmirror-gateway
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      ui:
        condition: service_started
      config-service:
        condition: service_healthy
      websocket-bridge:
        condition: service_started
    networks:
      - ozmirror-network
    restart: unless-stopped

  # =====================================
  # UI Container (React SPA)
  # =====================================
  ui:
    build:
      context: ./ui
      dockerfile: Dockerfile
    container_name: ozmirror-ui
    environment:
      - NODE_ENV=production
    networks:
      - ozmirror-network
    restart: unless-stopped

  # =====================================
  # Configuration Service (FastAPI)
  # =====================================
  config-service:
    build:
      context: ./services/config
      dockerfile: Dockerfile
    container_name: ozmirror-config
    environment:
      - REDIS_URL=${REDIS_URL}
      - CONFIG_STORAGE_TYPE=${CONFIG_STORAGE_TYPE:-json}
      - CONFIG_DATA_DIR=/app/data
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - config-data:/app/data
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - ozmirror-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  # =====================================
  # Redis (Message Broker)
  # =====================================
  redis:
    image: redis:7-alpine
    container_name: ozmirror-redis
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
    networks:
      - ozmirror-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

  # =====================================
  # WebSocket Bridge
  # =====================================
  websocket-bridge:
    build:
      context: ./services/websocket
      dockerfile: Dockerfile
    container_name: ozmirror-websocket
    environment:
      - REDIS_URL=${REDIS_URL}
      - PORT=${WEBSOCKET_PORT:-8080}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - ozmirror-network
    restart: unless-stopped

  # =====================================
  # Module: Clock
  # =====================================
  clock-module:
    build:
      context: ./modules/clock
      dockerfile: Dockerfile
    container_name: ozmirror-clock
    environment:
      - MODULE_ID=clock
      - CONFIG_SERVICE_URL=${CONFIG_SERVICE_URL}
      - REDIS_URL=${REDIS_URL}
      - PORT=3001
    volumes:
      - clock-data:/app/data
    depends_on:
      redis:
        condition: service_healthy
      config-service:
        condition: service_healthy
    networks:
      - ozmirror-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

# =====================================
# Volumes
# =====================================
volumes:
  config-data:
    driver: local
  redis-data:
    driver: local
  clock-data:
    driver: local

# =====================================
# Networks
# =====================================
networks:
  ozmirror-network:
    name: ozmirror-network
    driver: bridge
```

#### Step 2: Create docker-compose.dev.yml (30 minutes)

Create `/path/to/OZMirror\docker-compose.dev.yml`:

```yaml
version: '3.8'

# Development overrides for hot reload and debugging

services:
  ui:
    build:
      context: ./ui
      dockerfile: Dockerfile.dev
      target: development
    volumes:
      - ./ui/src:/app/src:ro
      - ./ui/public:/app/public:ro
    environment:
      - NODE_ENV=development
    ports:
      - "5173:5173"  # Vite dev server
    command: npm run dev

  config-service:
    volumes:
      - ./services/config/app:/app/app:ro
    environment:
      - LOG_LEVEL=debug
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  websocket-bridge:
    volumes:
      - ./services/websocket/src:/app/src:ro
    environment:
      - LOG_LEVEL=debug
      - NODE_ENV=development

  clock-module:
    volumes:
      - ./modules/clock/src:/app/src:ro
    environment:
      - LOG_LEVEL=debug
      - NODE_ENV=development
```

#### Step 3: Create Dockerfiles (1.5 hours)

**Nginx Dockerfile** - `nginx/Dockerfile`:

```dockerfile
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Config Service Dockerfile** - `services/config/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**WebSocket Bridge Dockerfile** - `services/websocket/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8080

# Run application
CMD ["node", "dist/server.js"]
```

**Clock Module Dockerfile** - `modules/clock/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run application
CMD ["node", "dist/server.js"]
```

**UI Dockerfile** - `ui/Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**UI Development Dockerfile** - `ui/Dockerfile.dev`:

```dockerfile
FROM node:18-alpine AS development

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

#### Step 4: Create Development Tooling Files (30 minutes)

**TypeScript Config** - `tsconfig.json` (for services/modules):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**ESLint Config** - `.eslintrc.js`:

```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
  },
};
```

**Prettier Config** - `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

#### Step 5: Validate Configuration (15 minutes)

```bash
# Validate docker-compose.yml syntax
docker-compose config

# You should see the full composed configuration with no errors
```

**✅ Phase 0 Complete Checklist**:
- [ ] All directories created
- [ ] .gitignore, .env.example, .env created
- [ ] README.md created
- [ ] docker-compose.yml created and validates
- [ ] docker-compose.dev.yml created
- [ ] All Dockerfiles created
- [ ] TypeScript, ESLint, Prettier configs created

---

## Phase 1: Core Infrastructure (Days 3-7)

### Day 3: Redis Setup & Pub/Sub Channels

#### Step 1: Test Redis Container (15 minutes)

```bash
# Start only Redis
docker-compose up -d redis

# Check it's running
docker-compose ps redis

# Check logs
docker-compose logs redis

# Test connection
docker-compose exec redis redis-cli ping
# Expected output: PONG
```

#### Step 2: Define Pub/Sub Channel Structure (30 minutes)

Create `docs/REDIS_CHANNELS.md`:

```markdown
# Redis Pub/Sub Channel Structure

## Channel Naming Convention

`events:<scope>:<optional-specifics>`

## System Channels

### events:system
System-wide events that affect all modules/UI

**Events**:
- `EDIT_MODE_CHANGED` - Edit mode toggled
- `THEME_CHANGED` - Theme switched
- `LAYOUT_PROFILE_CHANGED` - Layout profile switched
- `CONFIG_UPDATED` - Global settings updated

**Example Message**:
```json
{
  "action": "EDIT_MODE_CHANGED",
  "enabled": true,
  "timestamp": 1708012345000
}
```

### events:ui
UI interactions and state changes

**Events**:
- `MODULE_CLICKED` - Module was clicked
- `LAYOUT_CHANGED` - Layout drag/resize occurred
- `SETTINGS_OPENED` - Settings panel opened

**Example Message**:
```json
{
  "action": "MODULE_CLICKED",
  "instanceId": "clock_01",
  "timestamp": 1708012345000
}
```

## Module Channels

### events:modules:<moduleId>
Module-specific data updates

**Format**:
```json
{
  "instanceId": "clock_01",
  "data": { /* module-specific data */ },
  "timestamp": 1708012345000
}
```

**Examples**:
- `events:modules:clock` - Time updates
- `events:modules:weather` - Weather data updates
- `events:modules:calendar` - Calendar event updates
```

#### Step 3: Test Pub/Sub (15 minutes)

```bash
# Terminal 1: Subscribe to a channel
docker-compose exec redis redis-cli
> SUBSCRIBE events:system

# Terminal 2: Publish a test message
docker-compose exec redis redis-cli
> PUBLISH events:system "test message"

# Terminal 1 should receive:
# 1) "message"
# 2) "events:system"
# 3) "test message"
```

**✅ Redis Complete**:
- [ ] Redis container running
- [ ] Health check passing
- [ ] Can connect with redis-cli
- [ ] Pub/sub tested successfully
- [ ] Channel structure documented

---

### Days 4-5: Configuration Service (FastAPI)

#### Step 1: Create Python Project Structure (30 minutes)

Create `services/config/requirements.txt`:

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.6.0
redis==5.0.1
python-json-logger==2.0.7
```

Create `services/config/app/__init__.py`:

```python
"""OzMirror Configuration Service"""
__version__ = "1.0.0"
```

#### Step 2: Create Data Models (45 minutes)

Create `services/config/app/models.py`:

```python
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


class GridItem(BaseModel):
    """Grid layout item"""
    i: str  # instance ID (e.g., "clock_01")
    x: int  # x position
    y: int  # y position
    w: int  # width
    h: int  # height
    minW: Optional[int] = None
    minH: Optional[int] = None
    maxW: Optional[int] = None
    maxH: Optional[int] = None


class ModuleConfig(BaseModel):
    """Module instance configuration"""
    moduleId: str  # e.g., "clock"
    config: Dict[str, Any] = Field(default_factory=dict)


class LayoutProfile(BaseModel):
    """Layout profile containing grid and module configs"""
    grid: List[GridItem]
    moduleConfigs: Dict[str, ModuleConfig]  # instanceId -> config


class LayoutData(BaseModel):
    """Complete layout data"""
    activeProfile: str = "default"
    layouts: Dict[str, LayoutProfile]  # profileName -> profile


class ModuleManifest(BaseModel):
    """Module manifest metadata"""
    id: str
    name: str
    description: str
    version: str
    author: str
    icon: Optional[str] = None
    defaultConfig: Dict[str, Any] = Field(default_factory=dict)
    configSchema: Optional[Dict[str, Any]] = None
    gridConstraints: Optional[Dict[str, int]] = None


class RegisteredModule(BaseModel):
    """Registered module information"""
    id: str
    name: str
    serviceUrl: str
    manifest: ModuleManifest
    status: str = "online"  # online, offline, error
    registeredAt: datetime = Field(default_factory=datetime.utcnow)


class GlobalSettings(BaseModel):
    """Global application settings"""
    theme: str = "dark"
    kiosk: bool = False
    cursorTimeout: int = 3000  # ms
    fontScale: float = 1.0
    autoStart: bool = False


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    uptime: float
```

#### Step 3: Create Database Layer (1 hour)

Create `services/config/app/database.py`:

```python
import json
import os
from pathlib import Path
from typing import Optional
import fcntl
from contextlib import contextmanager
from app.models import LayoutData, GlobalSettings, RegisteredModule


class JSONDatabase:
    """Simple JSON file-based storage with file locking"""

    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.layout_file = self.data_dir / "layouts.json"
        self.modules_file = self.data_dir / "modules.json"
        self.settings_file = self.data_dir / "settings.json"

        # Initialize with defaults if files don't exist
        self._init_defaults()

    def _init_defaults(self):
        """Initialize default data files"""
        if not self.layout_file.exists():
            default_layout = {
                "activeProfile": "default",
                "layouts": {
                    "default": {
                        "grid": [
                            {"i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3}
                        ],
                        "moduleConfigs": {
                            "clock_01": {
                                "moduleId": "clock",
                                "config": {
                                    "format": "HH:mm:ss",
                                    "timezone": "UTC",
                                    "showDate": True
                                }
                            }
                        }
                    }
                }
            }
            self._write_json(self.layout_file, default_layout)

        if not self.modules_file.exists():
            self._write_json(self.modules_file, {"modules": []})

        if not self.settings_file.exists():
            default_settings = {
                "theme": "dark",
                "kiosk": False,
                "cursorTimeout": 3000,
                "fontScale": 1.0,
                "autoStart": False
            }
            self._write_json(self.settings_file, default_settings)

    @contextmanager
    def _file_lock(self, file_path: Path):
        """Context manager for file locking"""
        lock_file = file_path.with_suffix('.lock')
        lock_fd = open(lock_file, 'w')
        try:
            fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)
            yield
        finally:
            fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)
            lock_fd.close()

    def _read_json(self, file_path: Path) -> dict:
        """Read JSON file with locking"""
        with self._file_lock(file_path):
            with open(file_path, 'r') as f:
                return json.load(f)

    def _write_json(self, file_path: Path, data: dict):
        """Write JSON file with locking"""
        with self._file_lock(file_path):
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)

    # Layout operations
    def get_layout(self) -> LayoutData:
        data = self._read_json(self.layout_file)
        return LayoutData(**data)

    def save_layout(self, layout: LayoutData):
        self._write_json(self.layout_file, layout.model_dump())

    # Module operations
    def get_modules(self) -> list[RegisteredModule]:
        data = self._read_json(self.modules_file)
        return [RegisteredModule(**m) for m in data.get("modules", [])]

    def register_module(self, module: RegisteredModule):
        data = self._read_json(self.modules_file)
        modules = data.get("modules", [])

        # Remove existing registration if present
        modules = [m for m in modules if m.get("id") != module.id]

        # Add new registration
        modules.append(module.model_dump(mode='json'))

        self._write_json(self.modules_file, {"modules": modules})

    def get_module(self, module_id: str) -> Optional[RegisteredModule]:
        modules = self.get_modules()
        for module in modules:
            if module.id == module_id:
                return module
        return None

    # Settings operations
    def get_settings(self) -> GlobalSettings:
        data = self._read_json(self.settings_file)
        return GlobalSettings(**data)

    def save_settings(self, settings: GlobalSettings):
        self._write_json(self.settings_file, settings.model_dump())


# Global database instance
db = JSONDatabase(os.getenv("CONFIG_DATA_DIR", "/app/data"))
```

#### Step 4: Create REST API Routes (1.5 hours)

Create `services/config/app/routes/layout.py`:

```python
from fastapi import APIRouter, HTTPException
from app.models import LayoutData, LayoutProfile
from app.database import db
from typing import List

router = APIRouter(prefix="/api/config/layout", tags=["layout"])


@router.get("", response_model=LayoutData)
async def get_layout():
    """Get complete layout data"""
    return db.get_layout()


@router.put("")
async def update_layout(layout: LayoutData):
    """Update layout data"""
    db.save_layout(layout)
    return {"success": True}


@router.get("/profiles", response_model=List[str])
async def get_profiles():
    """Get list of profile names"""
    layout = db.get_layout()
    return list(layout.layouts.keys())


@router.post("/profiles")
async def create_profile(name: str, copyFrom: str = "default"):
    """Create new layout profile"""
    layout = db.get_layout()

    if name in layout.layouts:
        raise HTTPException(status_code=400, detail="Profile already exists")

    if copyFrom not in layout.layouts:
        raise HTTPException(status_code=404, detail=f"Source profile '{copyFrom}' not found")

    # Copy from source profile
    layout.layouts[name] = layout.layouts[copyFrom].model_copy(deep=True)
    db.save_layout(layout)

    return {"success": True, "profileId": name}


@router.delete("/profiles/{name}")
async def delete_profile(name: str):
    """Delete layout profile"""
    if name == "default":
        raise HTTPException(status_code=400, detail="Cannot delete default profile")

    layout = db.get_layout()

    if name not in layout.layouts:
        raise HTTPException(status_code=404, detail="Profile not found")

    del layout.layouts[name]

    # If active profile was deleted, switch to default
    if layout.activeProfile == name:
        layout.activeProfile = "default"

    db.save_layout(layout)
    return {"success": True}
```

Create `services/config/app/routes/modules.py`:

```python
from fastapi import APIRouter, HTTPException
from app.models import RegisteredModule, ModuleConfig
from app.database import db
from typing import List, Any, Dict

router = APIRouter(prefix="/api/config/modules", tags=["modules"])


@router.get("", response_model=List[RegisteredModule])
async def get_modules():
    """Get all registered modules"""
    return db.get_modules()


@router.get("/{module_id}", response_model=RegisteredModule)
async def get_module(module_id: str):
    """Get specific module by ID"""
    module = db.get_module(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@router.post("/register")
async def register_module(module: RegisteredModule):
    """Register a new module or update existing"""
    db.register_module(module)
    return {"success": True}


@router.get("/{module_id}/config/{instance_id}", response_model=Dict[str, Any])
async def get_module_config(module_id: str, instance_id: str):
    """Get configuration for a specific module instance"""
    layout = db.get_layout()

    # Get from active profile
    active_profile = layout.layouts.get(layout.activeProfile)
    if not active_profile:
        raise HTTPException(status_code=404, detail="Active profile not found")

    config = active_profile.moduleConfigs.get(instance_id)
    if not config:
        # Return default config from module manifest
        module = db.get_module(module_id)
        if module:
            return module.manifest.defaultConfig
        raise HTTPException(status_code=404, detail="Module instance not found")

    return config.config


@router.put("/{module_id}/config/{instance_id}")
async def update_module_config(module_id: str, instance_id: str, config: Dict[str, Any]):
    """Update configuration for a specific module instance"""
    layout = db.get_layout()

    # Update in active profile
    active_profile_name = layout.activeProfile
    active_profile = layout.layouts.get(active_profile_name)
    if not active_profile:
        raise HTTPException(status_code=404, detail="Active profile not found")

    if instance_id not in active_profile.moduleConfigs:
        raise HTTPException(status_code=404, detail="Module instance not found")

    # Update config
    active_profile.moduleConfigs[instance_id].config = config

    # Save
    db.save_layout(layout)

    return {"success": True}
```

Create `services/config/app/routes/settings.py`:

```python
from fastapi import APIRouter
from app.models import GlobalSettings
from app.database import db

router = APIRouter(prefix="/api/config/settings", tags=["settings"])


@router.get("", response_model=GlobalSettings)
async def get_settings():
    """Get global settings"""
    return db.get_settings()


@router.put("")
async def update_settings(settings: GlobalSettings):
    """Update global settings"""
    db.save_settings(settings)
    return {"success": True}
```

#### Step 5: Create Main Application (30 minutes)

Create `services/config/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time
import os
from app.routes import layout, modules, settings
from app.models import HealthResponse

# Initialize FastAPI app
app = FastAPI(
    title="OzMirror Configuration Service",
    description="Centralized configuration management for OzMirror",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(layout.router)
app.include_router(modules.router)
app.include_router(settings.router)

# Startup time for uptime calculation
start_time = time.time()


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        uptime=time.time() - start_time
    )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "OzMirror Configuration Service",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

#### Step 6: Build and Test (45 minutes)

```bash
# Build config service
docker-compose build config-service

# Start config service with Redis
docker-compose up -d redis config-service

# Check logs
docker-compose logs -f config-service

# Wait for health check to pass
docker-compose ps config-service

# Test endpoints
curl http://localhost:8000/health
# Expected: {"status":"healthy","version":"1.0.0","uptime":...}

curl http://localhost:8000/api/config/layout
# Expected: Full layout JSON

curl http://localhost:8000/api/config/modules
# Expected: [] (empty array, no modules registered yet)

curl http://localhost:8000/api/config/settings
# Expected: Default settings JSON
```

**✅ Config Service Complete**:
- [ ] FastAPI app builds successfully
- [ ] Container starts and health check passes
- [ ] All API endpoints respond
- [ ] Layout data persists to JSON file
- [ ] Settings persist correctly
- [ ] Module registration works

---

### Day 6: WebSocket Bridge

#### Step 1: Create Node.js Project (30 minutes)

Create `services/websocket/package.json`:

```json
{
  "name": "ozmirror-websocket-bridge",
  "version": "1.0.0",
  "description": "WebSocket bridge for OzMirror Redis pub/sub",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/server.ts",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "socket.io": "^4.6.1",
    "ioredis": "^5.3.2",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  }
}
```

Create `services/websocket/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Step 2: Create WebSocket Server (1 hour)

Create `services/websocket/src/server.ts`:

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { RedisBridge } from './redis-bridge';
import { logger } from './logger';

const PORT = parseInt(process.env.PORT || '8080', 10);

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*', // In production, specify actual origins
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Create Redis bridge
const redisBridge = new RedisBridge(process.env.REDIS_URL || 'redis://localhost:6379');

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Track subscribed channels for this socket
  const subscribedChannels = new Set<string>();

  // Handle channel subscription
  socket.on('subscribe', async (channels: string[]) => {
    logger.info(`Socket ${socket.id} subscribing to channels:`, channels);

    for (const channel of channels) {
      subscribedChannels.add(channel);

      // Subscribe to Redis and forward messages to this socket
      await redisBridge.subscribe(channel, (message) => {
        socket.emit('message', {
          channel,
          payload: message
        });
      });
    }
  });

  // Handle channel unsubscription
  socket.on('unsubscribe', async (channels: string[]) => {
    logger.info(`Socket ${socket.id} unsubscribing from channels:`, channels);

    for (const channel of channels) {
      subscribedChannels.delete(channel);
      await redisBridge.unsubscribe(channel);
    }
  });

  // Handle client publishing to Redis
  socket.on('publish', async ({ channel, payload }: { channel: string; payload: any }) => {
    logger.debug(`Socket ${socket.id} publishing to ${channel}:`, payload);
    await redisBridge.publish(channel, payload);
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    logger.info(`Client disconnected: ${socket.id}`);

    // Unsubscribe from all channels
    for (const channel of subscribedChannels) {
      await redisBridge.unsubscribe(channel);
    }
    subscribedChannels.clear();
  });
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`WebSocket Bridge listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...');
  httpServer.close(async () => {
    await redisBridge.close();
    process.exit(0);
  });
});
```

Create `services/websocket/src/redis-bridge.ts`:

```typescript
import Redis from 'ioredis';
import { logger } from './logger';

export class RedisBridge {
  private publisherClient: Redis;
  private subscriberClient: Redis;
  private channelHandlers: Map<string, Set<(message: any) => void>>;

  constructor(redisUrl: string) {
    this.publisherClient = new Redis(redisUrl);
    this.subscriberClient = new Redis(redisUrl);
    this.channelHandlers = new Map();

    // Set up subscriber message handler
    this.subscriberClient.on('message', (channel: string, message: string) => {
      const handlers = this.channelHandlers.get(channel);
      if (handlers) {
        let parsedMessage: any;
        try {
          parsedMessage = JSON.parse(message);
        } catch (e) {
          parsedMessage = message;
        }

        handlers.forEach(handler => handler(parsedMessage));
      }
    });

    logger.info('Redis bridge initialized');
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    // Add handler to map
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
      // Subscribe to Redis channel
      await this.subscriberClient.subscribe(channel);
      logger.info(`Subscribed to Redis channel: ${channel}`);
    }

    this.channelHandlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string): Promise<void> {
    const handlers = this.channelHandlers.get(channel);
    if (handlers && handlers.size === 0) {
      await this.subscriberClient.unsubscribe(channel);
      this.channelHandlers.delete(channel);
      logger.info(`Unsubscribed from Redis channel: ${channel}`);
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    await this.publisherClient.publish(channel, messageStr);
    logger.debug(`Published to ${channel}:`, message);
  }

  async close(): Promise<void> {
    await this.publisherClient.quit();
    await this.subscriberClient.quit();
    logger.info('Redis bridge closed');
  }
}
```

Create `services/websocket/src/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

#### Step 3: Build and Test (30 minutes)

```bash
# Build WebSocket bridge
docker-compose build websocket-bridge

# Start with Redis
docker-compose up -d redis websocket-bridge

# Check logs
docker-compose logs -f websocket-bridge

# Test with a WebSocket client (use browser console or tool)
```

Create test HTML file `test-websocket.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
  <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
</head>
<body>
  <h1>WebSocket Bridge Test</h1>
  <button onclick="subscribe()">Subscribe to events:system</button>
  <button onclick="publish()">Publish Test Message</button>
  <div id="messages"></div>

  <script>
    const socket = io('http://localhost:80/ws', {
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      document.getElementById('messages').innerHTML += '<p>Connected!</p>';
    });

    socket.on('message', (msg) => {
      console.log('Received:', msg);
      document.getElementById('messages').innerHTML +=
        `<p><strong>${msg.channel}:</strong> ${JSON.stringify(msg.payload)}</p>`;
    });

    function subscribe() {
      socket.emit('subscribe', ['events:system', 'events:modules:clock']);
      console.log('Subscribed to channels');
    }

    function publish() {
      socket.emit('publish', {
        channel: 'events:system',
        payload: { action: 'TEST', timestamp: Date.now() }
      });
      console.log('Published test message');
    }
  </script>
</body>
</html>
```

**✅ WebSocket Bridge Complete**:
- [ ] Container builds and starts
- [ ] Connects to Redis successfully
- [ ] WebSocket connections accepted
- [ ] Can subscribe to channels
- [ ] Messages forwarded from Redis to WebSocket
- [ ] Can publish from WebSocket to Redis

---

### Day 7: API Gateway (Nginx)

#### Step 1: Create Nginx Configuration (1 hour)

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Upstream services
    upstream config_service {
        server config-service:8000;
    }

    upstream websocket_bridge {
        server websocket-bridge:8080;
    }

    upstream ui_service {
        server ui:80;
    }

    # Main server block
    server {
        listen 80;
        server_name localhost;

        # Client max body size
        client_max_body_size 10M;

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }

        # Config Service API
        location /api/config {
            proxy_pass http://config_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # CORS headers
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

            # Preflight requests
            if ($request_method = OPTIONS) {
                return 204;
            }
        }

        # Module APIs (will be expanded as modules are added)
        location /api/modules/clock {
            proxy_pass http://clock-module:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # CORS
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type" always;

            if ($request_method = OPTIONS) {
                return 204;
            }
        }

        # WebSocket Bridge
        location /ws {
            proxy_pass http://websocket_bridge;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket timeouts
            proxy_read_timeout 86400;
            proxy_send_timeout 86400;
        }

        # React UI (SPA)
        location / {
            proxy_pass http://ui_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

#### Step 2: Build and Test Gateway (30 minutes)

```bash
# Build gateway
docker-compose build gateway

# Start all infrastructure services
docker-compose up -d redis config-service websocket-bridge gateway

# Check all services are running
docker-compose ps

# Test gateway routing
curl http://localhost:80/health
# Expected: OK

curl http://localhost:80/api/config/settings
# Expected: Settings JSON

# Test WebSocket proxy (use test-websocket.html from earlier)
# Open in browser: http://localhost:80/test-websocket.html
```

**✅ API Gateway Complete**:
- [ ] Nginx container builds and starts
- [ ] Health check endpoint works
- [ ] Routes /api/config/* to Config Service
- [ ] Routes /ws to WebSocket Bridge with upgrade headers
- [ ] CORS headers properly configured
- [ ] All proxy routes working

---

## End of Phase 1 - Complete Infrastructure Test

### Full Integration Test (30 minutes)

```bash
# Start ALL infrastructure services
docker-compose up -d

# Verify all containers are healthy
docker-compose ps

# Test complete flow:
# 1. Config Service via Gateway
curl http://localhost:80/api/config/layout

# 2. Redis pub/sub
docker-compose exec redis redis-cli
> PUBLISH events:system '{"action":"TEST"}'

# 3. WebSocket (open test-websocket.html in browser)
# Should receive the TEST message published above

# 4. Check logs for any errors
docker-compose logs --tail=50
```

### Performance Check

```bash
# Check resource usage
docker stats --no-stream

# Verify memory usage is reasonable
# Target: All infrastructure < 500MB combined
```

---

## Complete Verification Checklist

### Phase 0: Bootstrap
- [ ] All directories created correctly
- [ ] .gitignore excludes proper files
- [ ] .env.example comprehensive
- [ ] .env created with actual values
- [ ] README.md provides clear overview
- [ ] docker-compose.yml validates without errors
- [ ] docker-compose.dev.yml created
- [ ] All Dockerfiles created and properly structured
- [ ] TypeScript config created
- [ ] ESLint and Prettier configs created

### Phase 1: Infrastructure
#### Redis
- [ ] Redis container starts successfully
- [ ] Health check passes
- [ ] Can connect with redis-cli
- [ ] PING command returns PONG
- [ ] Pub/sub works (tested manually)
- [ ] Data persists to volume
- [ ] Channel structure documented

#### Configuration Service
- [ ] Container builds successfully
- [ ] FastAPI app starts
- [ ] Health check endpoint responds
- [ ] GET /api/config/layout returns data
- [ ] PUT /api/config/layout saves data
- [ ] Module registration works
- [ ] Settings CRUD operations work
- [ ] Data persists to JSON files
- [ ] File locking prevents corruption
- [ ] All API endpoints tested with curl

#### WebSocket Bridge
- [ ] Container builds successfully
- [ ] Server starts and listens on port 8080
- [ ] Connects to Redis
- [ ] WebSocket connections accepted
- [ ] Subscribe to channels works
- [ ] Messages forwarded from Redis to WebSocket
- [ ] Publish from WebSocket to Redis works
- [ ] Disconnection cleanup works
- [ ] Multiple simultaneous connections supported

#### API Gateway
- [ ] Nginx container builds successfully
- [ ] Starts and listens on port 80
- [ ] Health check endpoint accessible
- [ ] Routes to Config Service work
- [ ] Routes to WebSocket Bridge work (with upgrade)
- [ ] CORS headers present
- [ ] Can handle OPTIONS preflight requests
- [ ] Gzip compression enabled

### Integration
- [ ] All services start together with docker-compose up
- [ ] All health checks pass
- [ ] Config Service accessible via gateway
- [ ] WebSocket accessible via gateway /ws
- [ ] Redis pub/sub → WebSocket flow works end-to-end
- [ ] No errors in logs
- [ ] Total memory usage acceptable (<500MB for infrastructure)
- [ ] Can restart services without issues

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs <service-name>

# Check if port is already in use
netstat -an | grep <port>

# Rebuild container
docker-compose build --no-cache <service-name>
```

### Redis Connection Issues
```bash
# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Verify REDIS_URL environment variable
docker-compose exec config-service env | grep REDIS
```

### Config Service API Errors
```bash
# Check if data directory exists
docker-compose exec config-service ls -la /app/data

# Check file permissions
docker-compose exec config-service ls -la /app/data/*.json

# Test direct to service (bypassing gateway)
docker-compose exec config-service curl localhost:8000/health
```

### WebSocket Connection Fails
```bash
# Check WebSocket Bridge logs
docker-compose logs websocket-bridge

# Test WebSocket upgrade headers
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:80/ws
```

### Gateway Routing Issues
```bash
# Check Nginx config syntax
docker-compose exec gateway nginx -t

# View Nginx access logs
docker-compose logs gateway | grep access

# Test direct to upstream service
docker-compose exec config-service curl localhost:8000/health
```

---

## Next Steps

**✅ Phase 1 Complete!** You now have a working backend infrastructure.

**Next**: [Clock Module Plan](03-clock-module.md) - Build the first module to prove the architecture

**Or continue with**: [UI Container Development Plan](02-ui-container.md) - Build the React frontend

---

## Files Created Summary

```
/path/to/OZMirror\
├── .gitignore
├── .env.example
├── .env
├── README.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
├── services/
│   ├── config/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── main.py
│   │       ├── models.py
│   │       ├── database.py
│   │       └── routes/
│   │           ├── layout.py
│   │           ├── modules.py
│   │           └── settings.py
│   └── websocket/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── server.ts
│           ├── redis-bridge.ts
│           └── logger.ts
├── modules/
│   └── clock/
│       └── Dockerfile
├── ui/
│   ├── Dockerfile
│   └── Dockerfile.dev
└── docs/
    ├── REDIS_CHANNELS.md
    └── plans/
        └── 01-infrastructure-setup.md
```

**Total Time**: 7 days (56 hours)
**Status**: ✅ Ready for Phase 2
