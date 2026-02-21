# OzMirror — Product Specification

**Version:** 1.0.0-draft
**Status:** In Progress
**Last Updated:** 2026-02-13

---

## 1. Overview

OzMirror is a distributed, microservices-based smart display application inspired by MagicMirror2. Each module runs as an independent Docker container with its own state management, communicating via REST APIs and Redis pub/sub messaging. The system can scale from a single Raspberry Pi 4 to a distributed multi-node deployment. Users compose a full-screen web dashboard from these independent service modules, arrange them via drag-and-drop, and interact via touchscreen, mouse, or keyboard.

### 1.1 Goals

- Provide a distributed, container-based module system where each module is independently deployable
- Support full-screen kiosk deployment with zero-mouse operation (touch-first)
- Allow non-technical users to configure and rearrange their display via a web UI
- Enable horizontal scaling while remaining lightweight enough to run entirely on a single Raspberry Pi 4
- Each module manages its own state and communicates via standard REST APIs
- Use Redis for real-time messaging and event propagation between modules
- Be maintainable and testable with clean separation of concerns

### 1.2 Non-Goals (v1)

- Cloud sync of layouts or module configs
- Multi-display spanning (single screen only in v1)
- Native mobile app (iOS / Android)
- Built-in module marketplace / package manager (planned for v2)

---

## 2. Tech Stack

### 2.1 Core Infrastructure

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Containerization | Docker + Docker Compose | Service isolation, easy deployment on Pi 4 |
| Message broker | Redis 7+ | Pub/sub messaging, caching, lightweight on Pi |
| API Gateway | Nginx or Traefik | Request routing, load balancing, SSL termination |
| Service discovery | Docker DNS / Consul (optional) | Auto-discovery of module containers |

### 2.2 Frontend (UI Container)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend framework | React 18 + TypeScript | Component model maps well to module widgets |
| Build tool | Vite | Fast HMR, modern ESM output |
| State management | Zustand + React Query | Local UI state + server state management |
| Layout engine | react-grid-layout | Drag, resize, responsive breakpoints |
| Gesture / input | @use-gesture/react | Unified pointer/touch gesture handling |
| Styling | CSS Modules + CSS variables | Scoped styles, themeable via variable overrides |
| WebSocket client | Socket.io-client | Real-time updates from Redis pub/sub |
| HTTP client | Axios | REST API calls to modules |
| Web server | Nginx (static files) | Serve the React SPA |

### 2.3 Backend Services (Module Containers)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Module runtime | Node.js (TS) or Python FastAPI | Flexible, lightweight, async-first |
| REST framework | Express.js or FastAPI | Standard REST API per module |
| Redis client | ioredis (Node) / redis-py (Python) | Pub/sub and caching |
| Config client | HTTP client to config service | Fetch module-specific config |
| State persistence | SQLite or JSON files (per module) | Each module owns its data |
| Testing | Vitest/Jest or Pytest | Unit and integration tests |

### 2.4 Configuration Service

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Config API | FastAPI or Express | CRUD REST API for all configs |
| Storage | PostgreSQL or JSON files | Centralized config store |
| Validation | JSON Schema | Enforce config structure |

### 2.5 Deployment & Monitoring

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Orchestration | Docker Compose (Pi) / K3s (distributed) | Single-node or multi-node |
| Logging | Fluent Bit → Loki (optional) | Centralized log aggregation |
| Metrics | Prometheus + Grafana (optional) | Service health monitoring |

---

## 3. Architecture

### 3.1 High-Level Diagram

```
                          ┌─────────────────────────┐
                          │   Browser / Kiosk       │
                          │   (Chromium fullscreen) │
                          └────────────┬────────────┘
                                       │ HTTPS
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Nginx / API Gateway                        │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Static Files │  │  /api/* → REST │  │ /ws → WebSocket     │  │
│  │ (React SPA)  │  │   Routing      │  │   (Redis pub/sub)   │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
└────────┬─────────────────────┬────────────────────┬──────────────┘
         │                     │                    │
         │ HTTP                │ HTTP               │ WS
         ▼                     ▼                    ▼
┌────────────────┐    ┌─────────────────────────────────────────┐
│  UI Container  │    │         Backend Services                │
│  (React SPA)   │    │  ┌──────────────────────────────────┐  │
│                │    │  │    Configuration Service         │  │
│  • Layout Mgr  │    │  │    (REST API + PostgreSQL)       │  │
│  • Module Reg  │    │  └──────────────┬───────────────────┘  │
│  • Input Hand  │    │                 │                      │
│  • Theme Mgr   │    │  ┌──────────────▼──────┐               │
└────────┬───────┘    │  │   Redis (v7+)       │               │
         │            │  │  • Pub/Sub          │               │
         │            │  │  • Event Bus        │               │
         │            │  │  • Cache            │               │
         │            │  └──────────┬──────────┘               │
         │            │             │                          │
         │ REST/WS    │  ┌──────────▼───────────────────────┐  │
         └────────────┼─►│      Module Containers          │  │
                      │  │  ┌─────────┐  ┌──────────────┐  │  │
                      │  │  │ Clock   │  │  Weather     │  │  │
                      │  │  │ (Node)  │  │  (Python)    │  │  │
                      │  │  ├─────────┤  ├──────────────┤  │  │
                      │  │  │ REST AP │  │  REST API    │  │  │
                      │  │  │ Redis ◄─┼──┼─► Redis Sub  │  │  │
                      │  │  │ SQLite  │  │  SQLite      │  │  │
                      │  │  └─────────┘  └──────────────┘  │  │
                      │  │                                  │  │
                      │  │  ┌───────────┐  ┌────────────┐  │  │
                      │  │  │ Calendar  │  │    RSS     │  │  │
                      │  │  │ (Node)    │  │  (Python)  │  │  │
                      │  │  └───────────┘  └────────────┘  │  │
                      │  └──────────────────────────────────┘  │
                      └─────────────────────────────────────────┘

                    Docker Compose (Single Raspberry Pi 4)
                    or K3s Cluster (Distributed Deployment)
```

### 3.2 Core Components

#### 3.2.1 UI Container (Frontend)

**Technologies:** React 18, TypeScript, Vite, Nginx
**Port:** 80/443 (via API Gateway)

- **Layout Manager** — Manages grid state using `react-grid-layout`. Fetches layout config from Config Service via REST.

- **Module Registry** — Discovers available modules by querying Config Service. Renders module widgets that communicate with their backend services via REST/WebSocket.

- **Input Handler** — Normalizes touch, pointer, and keyboard events into actions. Publishes events to Redis via WebSocket bridge.

- **Theme Manager** — Loads themes from Config Service, applies CSS variables dynamically.

- **State Management** — Zustand for UI state, React Query for server state caching.

#### 3.2.2 API Gateway

**Technologies:** Nginx or Traefik
**Port:** 80/443

- Routes `/api/config/*` → Configuration Service
- Routes `/api/modules/*` → Module containers (round-robin if scaled)
- Routes `/ws` → WebSocket server (Redis pub/sub bridge)
- Serves static files (React SPA) from `/`
- SSL termination, rate limiting, CORS handling

#### 3.2.3 Configuration Service

**Technologies:** FastAPI (Python) or Express (Node.js) + PostgreSQL
**Port:** 8000 (internal)

- **REST API** for CRUD operations on:
  - Layout configurations (grid positions, active modules)
  - Per-module configurations
  - Global settings (themes, display preferences)
  - User profiles (future: multi-user support)

- **Endpoints:**
  - `GET /api/config/layout` — Fetch active layout
  - `PUT /api/config/layout` — Save layout changes
  - `GET /api/config/modules` — List all registered modules
  - `GET /api/config/modules/:id` — Get module config
  - `PUT /api/config/modules/:id` — Update module config
  - `POST /api/config/validate` — Validate config against JSON schema

- **Storage:** PostgreSQL for relational data, or structured JSON files for simplicity on Pi.

#### 3.2.4 Redis Message Broker

**Technologies:** Redis 7+
**Port:** 6379 (internal)

- **Pub/Sub Channels:**
  - `events:ui` — UI interactions (clicks, drags, key presses)
  - `events:modules` — Module state changes, data updates
  - `events:system` — System-wide events (edit mode toggle, theme change)

- **Caching:** Module data cache (e.g., weather API responses) to reduce external API calls.

- **Presence:** Track online/offline status of module containers.

#### 3.2.5 Module Containers

**Technologies:** Node.js (Express) or Python (FastAPI)
**Ports:** 3001, 3002, 3003... (internal, proxied via API Gateway)

Each module is a Docker container that:

- **Exposes REST API:**
  - `GET /health` — Health check
  - `GET /data` — Fetch current module data
  - `POST /action` — Trigger module-specific actions
  - `GET /config` — Fetch module config from Config Service

- **Manages State:** Own SQLite DB or JSON file for persistent state.

- **Subscribes to Redis:** Listen to relevant pub/sub channels for real-time events.

- **Publishes Events:** Emit state changes to Redis for UI updates.

- **Examples:**
  - **Clock Module:** Publishes time updates every second to Redis `events:modules:clock`
  - **Weather Module:** Polls weather API every 10 minutes, caches in Redis, publishes updates
  - **Calendar Module:** Fetches events from Google Calendar API, stores in SQLite, publishes to Redis

#### 3.2.6 WebSocket Bridge (Optional Service)

**Technologies:** Node.js + Socket.io + ioredis
**Port:** 8080 (proxied via API Gateway at `/ws`)

- Bridges Redis pub/sub to WebSocket connections for real-time UI updates.
- Listens to `events:*` channels and forwards to connected browsers.
- Receives events from UI (e.g., user clicks) and publishes to Redis.

---

## 4. Module System

### 4.1 Module Architecture

Each module consists of **two parts**:

1. **Backend Service (Docker Container)** — REST API + business logic + state management
2. **Frontend Widget (React Component)** — UI rendering, communicates with backend via REST/WS

### 4.2 Backend Module Interface (REST API)

Every module container must expose the following REST endpoints:

#### 4.2.1 Standard Endpoints

```yaml
GET /health
  Response: { "status": "healthy", "uptime": 12345, "version": "1.0.0" }

GET /manifest
  Response:
    {
      "id": "clock",
      "name": "Clock",
      "description": "Digital/analog clock with timezone support",
      "version": "1.0.0",
      "author": "OzMirror",
      "icon": "clock-icon.svg",
      "defaultConfig": { "format": "HH:mm", "timezone": "UTC", "showDate": true },
      "configSchema": { ... JSON Schema ... },
      "gridConstraints": { "minW": 2, "minH": 2, "maxW": 8, "maxH": 4, "defaultW": 4, "defaultH": 3 }
    }

GET /data
  Query params: ?instanceId=clock_01
  Response: { "time": "14:32:05", "date": "2026-02-13", "timezone": "America/New_York" }

POST /action
  Body: { "instanceId": "clock_01", "action": "setTimezone", "payload": { "timezone": "Europe/London" } }
  Response: { "success": true, "data": { ... } }

GET /config/:instanceId
  Response: { "format": "HH:mm:ss", "timezone": "America/New_York", "showDate": true }
```

#### 4.2.2 Module Lifecycle

```python
# Pseudocode for module service

@app.on_event("startup")
async def startup():
    # 1. Register with Config Service
    await register_module(manifest)

    # 2. Connect to Redis
    redis = await connect_redis()

    # 3. Subscribe to relevant channels
    await redis.subscribe(f"events:modules:{module_id}")

    # 4. Load persisted state
    await load_state()

    # 5. Start background tasks (e.g., periodic updates)
    asyncio.create_task(update_loop())

@app.on_event("shutdown")
async def shutdown():
    # Cleanup, save state, unregister
    await save_state()
    await redis.close()
```

#### 4.2.3 Redis Pub/Sub Integration

```python
# Example: Weather module publishing updates

async def update_loop():
    while True:
        weather_data = await fetch_weather_from_api()

        # Publish to Redis for real-time UI updates
        await redis.publish(
            "events:modules:weather",
            json.dumps({
                "instanceId": "weather_01",
                "data": weather_data,
                "timestamp": time.time()
            })
        )

        await asyncio.sleep(600)  # Update every 10 minutes
```

### 4.3 Frontend Module Interface (React)

Each module has a React component registered in the UI container:

```tsx
// modules/clock/ClockWidget.tsx

import { useModuleData, useModuleConfig } from '@/hooks/useModule';

interface ClockWidgetProps {
  instanceId: string;      // e.g., "clock_01"
  isEditMode: boolean;
  config: ClockConfig;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({ instanceId, isEditMode, config }) => {
  // Fetch data from backend via REST (cached with React Query)
  const { data, isLoading } = useModuleData<ClockData>('clock', instanceId);

  // Subscribe to real-time updates via WebSocket (Redis pub/sub bridge)
  useModuleEvents('clock', instanceId, (event) => {
    // Update local state when backend publishes changes
  });

  if (isLoading) return <Skeleton />;

  return (
    <div className={styles.clock}>
      <div className={styles.time}>{data.time}</div>
      {config.showDate && <div className={styles.date}>{data.date}</div>}
    </div>
  );
};
```

### 4.4 Module Registration

Modules self-register with the Config Service on startup:

```bash
# When a module container starts, it POSTs its manifest to the Config Service

POST /api/config/modules/register
Body:
  {
    "id": "clock",
    "name": "Clock",
    "serviceUrl": "http://clock-service:3001",
    "manifest": { ... },
    "status": "online"
  }
```

The UI fetches the module registry from the Config Service:

```ts
// UI Container - Module Registry

const { data: modules } = useQuery('modules', async () => {
  const response = await axios.get('/api/config/modules');
  return response.data; // Array of registered modules
});
```

### 4.5 Module Discovery & Deployment

Modules are defined in `docker-compose.yml`:

```yaml
services:
  clock-module:
    build: ./modules/clock
    container_name: ozmirror-clock
    environment:
      - MODULE_ID=clock
      - CONFIG_SERVICE_URL=http://config-service:8000
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - config-service
    restart: unless-stopped

  weather-module:
    build: ./modules/weather
    container_name: ozmirror-weather
    environment:
      - MODULE_ID=weather
      - CONFIG_SERVICE_URL=http://config-service:8000
      - REDIS_URL=redis://redis:6379
      - WEATHER_API_KEY=${WEATHER_API_KEY}
    depends_on:
      - redis
      - config-service
    restart: unless-stopped
```

### 4.6 Module State Management

Each module owns its state and persists it independently:

```
/modules/clock/
  ├── Dockerfile
  ├── package.json
  ├── src/
  │   ├── server.ts         ← Express/FastAPI server
  │   ├── routes.ts         ← REST endpoints
  │   ├── redis-client.ts   ← Redis pub/sub
  │   └── state.ts          ← State management (SQLite/JSON)
  ├── data/
  │   └── clock-state.db    ← Persisted state (volume-mounted)
  └── tests/
      └── clock.test.ts
```

---

## 5. Layout System

### 5.1 Grid

The canvas is a `react-grid-layout` responsive grid. Default grid parameters:

| Parameter | Value |
|-----------|-------|
| Columns | 24 |
| Row height | 40px |
| Margin | [8px, 8px] |
| Container padding | [16px, 16px] |
| Breakpoints | lg: 1200, md: 996, sm: 768 |

### 5.2 Edit Mode

Edit mode is toggled by the user via a hotkey (`E`) or a floating action button. When active:

- Module resize handles are displayed
- Modules can be dragged and repositioned
- A "+" button reveals the Module Picker drawer
- Each module displays a context menu button (settings, remove)
- The app emits an `APP_EDIT_MODE_CHANGED` event so modules can adjust their rendering

When edit mode is exited, the layout is automatically persisted to disk.

### 5.3 Layout Profiles

Users can save named layout profiles (e.g., "Morning", "Night"). Switching profiles immediately swaps the active grid layout and module configs. Profiles are stored in `electron-store` under `layouts.<profileName>`.

### 5.4 Persistence Format

```json
{
  "activeProfile": "default",
  "layouts": {
    "default": {
      "grid": [
        { "i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3 },
        { "i": "weather_01", "x": 4, "y": 0, "w": 6, "h": 3 }
      ],
      "moduleConfigs": {
        "clock_01": { "moduleId": "clock", "format": "HH:mm", "showDate": true },
        "weather_01": { "moduleId": "weather", "city": "New York", "units": "metric" }
      }
    }
  }
}
```

---

## 6. Input Handling

### 6.1 Unified Input Model

All input is normalized to a set of **Input Actions** dispatched on the Event Bus:

| Action | Triggers |
|--------|----------|
| INPUT_TAP | Mouse click, touch tap |
| INPUT_LONG_PRESS | Touch/mouse hold > 500ms |
| INPUT_SWIPE | Touch/pointer drag gesture |
| INPUT_HOVER | Mouse enter/leave |
| INPUT_KEY | Keyboard keydown |
| INPUT_CONTEXT | Right-click or long-press on module |

### 6.2 Global Keyboard Shortcuts

| Key | Action |
|-----|--------|
| E | Toggle edit mode |
| Escape | Close open panel / exit edit mode |
| F | Toggle fullscreen |
| Tab | Cycle focus between modules |
| Cmd/Ctrl + Z | Undo last layout change |
| Cmd/Ctrl + S | Force save layout |

### 6.3 Touch Gestures

Using `@use-gesture/react` with the following defaults:

- **Tap** — activates the tapped module (focus/click)
- **Long press (500ms)** — opens module context menu (if in edit mode, initiates drag)
- **Swipe left/right** — forwarded to the focused module for custom handling (e.g., dismiss notifications)
- **Two-finger swipe down** — opens the Settings Panel

### 6.4 Cursor Behavior

In kiosk mode, the cursor is hidden by default after 3 seconds of inactivity. It reappears immediately on mouse movement.

---

## 7. Settings & Configuration UI

### 7.1 Settings Panel

A slide-in overlay (not a separate window) accessible via:

- Swipe down gesture (touch)
- Gear icon (click in edit mode)
- Cmd/Ctrl + `,` keyboard shortcut

**Sections:**

- **Display** — brightness (via IPC on supported hardware), theme, font scale
- **Layout** — manage profiles, reset to default, export/import layout JSON
- **Modules** — global enable/disable per module type
- **System** — auto-start, update check, kiosk mode toggle, app version

### 7.2 Per-Module Settings

Right-clicking (or long-pressing) a module in edit mode opens a module context menu with: **Edit Settings**, **Duplicate**, **Remove**. "Edit Settings" opens a modal containing the module's `settingsComponent`, falling back to an auto-generated form from `configSchema` if no custom component is provided.

### 7.3 Theming

Themes are JSON files stored in `/themes`. Each theme overrides a set of CSS custom properties. Built-in themes: **dark** (default), **light**, **amoled**. Users can load custom theme files.

```json
{
  "name": "Amoled Dark",
  "variables": {
    "--color-bg": "#000000",
    "--color-surface": "#0a0a0a",
    "--color-accent": "#00e5ff",
    "--color-text": "#e0e8f0",
    "--font-base": "'Space Mono', monospace"
  }
}
```

---

## 8. Bundled Modules (v1)

| Module ID | Description | Config options |
|-----------|-------------|----------------|
| clock | Digital / analog clock | Format, timezone, show seconds, show date |
| weather | Current weather + 3-day forecast | City, units (metric/imperial), API key |
| calendar | Upcoming calendar events | Google/iCal URL, days to show |
| rss_feed | Scrolling RSS / news headlines | Feed URL, item count, scroll speed |
| system_stats | CPU, RAM, disk usage | Update interval, which stats to show |
| sticky_notes | Editable text notes on screen | Font size, color |

---

## 9. REST API Specification

### 9.1 Configuration Service API

**Base URL:** `/api/config`

#### Layout Management

```http
GET /api/config/layout
Response: { "activeProfile": "default", "layouts": { ... } }

PUT /api/config/layout
Body: { "profileName": "default", "grid": [...], "moduleConfigs": {...} }
Response: { "success": true }

GET /api/config/layout/profiles
Response: ["default", "morning", "night"]

POST /api/config/layout/profiles
Body: { "name": "morning", "copyFrom": "default" }
Response: { "success": true, "profileId": "morning" }

DELETE /api/config/layout/profiles/:name
Response: { "success": true }
```

#### Module Registry

```http
GET /api/config/modules
Response: [
  { "id": "clock", "name": "Clock", "status": "online", "serviceUrl": "...", "manifest": {...} },
  { "id": "weather", "name": "Weather", "status": "online", ... }
]

GET /api/config/modules/:id
Response: { "id": "clock", "manifest": {...}, "status": "online" }

POST /api/config/modules/register
Body: { "id": "clock", "serviceUrl": "http://clock:3001", "manifest": {...} }
Response: { "success": true }

GET /api/config/modules/:id/config/:instanceId
Response: { "format": "HH:mm", "timezone": "UTC", "showDate": true }

PUT /api/config/modules/:id/config/:instanceId
Body: { "format": "HH:mm:ss", "timezone": "America/New_York" }
Response: { "success": true }
```

#### Global Settings

```http
GET /api/config/settings
Response: { "theme": "dark", "kiosk": true, "cursorTimeout": 3000, ... }

PUT /api/config/settings
Body: { "theme": "amoled", "cursorTimeout": 5000 }
Response: { "success": true }

GET /api/config/themes
Response: [{ "id": "dark", "name": "Dark", "variables": {...} }, ...]

POST /api/config/themes
Body: { "id": "custom", "name": "My Theme", "variables": {...} }
Response: { "success": true }
```

### 9.2 Module API (Generic)

Each module container exposes:

```http
GET /health
Response: { "status": "healthy", "uptime": 12345, "version": "1.0.0" }

GET /manifest
Response: { "id": "...", "name": "...", "configSchema": {...}, ... }

GET /data?instanceId=<id>
Response: { /* module-specific data */ }

POST /action
Body: { "instanceId": "...", "action": "...", "payload": {...} }
Response: { "success": true, "data": {...} }
```

### 9.3 WebSocket Events (Redis Pub/Sub Bridge)

**Endpoint:** `ws://gateway:80/ws`

#### Client → Server

```json
{
  "type": "subscribe",
  "channels": ["events:modules:clock", "events:ui"]
}

{
  "type": "publish",
  "channel": "events:ui",
  "payload": {
    "action": "MODULE_CLICKED",
    "instanceId": "clock_01",
    "timestamp": 1234567890
  }
}
```

#### Server → Client

```json
{
  "channel": "events:modules:clock",
  "payload": {
    "instanceId": "clock_01",
    "data": { "time": "14:32:05", "date": "2026-02-13" },
    "timestamp": 1234567890
  }
}

{
  "channel": "events:system",
  "payload": {
    "action": "EDIT_MODE_CHANGED",
    "enabled": true
  }
}
```

---

## 10. File Structure

```
ozmirror/
├── docker-compose.yml           ← Orchestration for all services
├── docker-compose.dev.yml       ← Development overrides (hot reload)
├── .env.example                 ← Environment variables template
├── nginx/
│   ├── Dockerfile
│   ├── nginx.conf               ← API Gateway routing
│   └── ssl/                     ← SSL certificates (optional)
│
├── ui/                          ← Frontend (React SPA)
│   ├── Dockerfile
│   ├── nginx.conf               ← Static file serving
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx             ← React entry
│   │   ├── App.tsx              ← Root component
│   │   ├── core/
│   │   │   ├── LayoutManager.ts
│   │   │   ├── ModuleRegistry.ts ← Fetches from Config Service
│   │   │   ├── WebSocketClient.ts ← Redis pub/sub bridge
│   │   │   └── InputHandler.ts
│   │   ├── components/
│   │   │   ├── Canvas/          ← react-grid-layout
│   │   │   ├── ModuleWidget/    ← Generic widget wrapper
│   │   │   ├── ModulePicker/    ← Add module drawer
│   │   │   ├── SettingsPanel/   ← Global settings
│   │   │   └── EditToolbar/     ← Edit mode controls
│   │   ├── widgets/             ← React components for each module
│   │   │   ├── ClockWidget.tsx
│   │   │   ├── WeatherWidget.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useModuleData.ts ← React Query wrapper
│   │   │   ├── useModuleEvents.ts ← WebSocket subscriptions
│   │   │   ├── useLayout.ts
│   │   │   └── useConfig.ts
│   │   ├── api/
│   │   │   ├── config.ts        ← Axios client for Config Service
│   │   │   └── modules.ts       ← Axios client for module APIs
│   │   ├── store/
│   │   │   └── appStore.ts      ← Zustand (UI state only)
│   │   └── types/
│   │       └── index.ts
│   └── public/
│       └── themes/              ← Theme JSON files
│
├── services/
│   ├── config/                  ← Configuration Service
│   │   ├── Dockerfile
│   │   ├── requirements.txt     ← FastAPI + dependencies
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py        ← Pydantic models
│   │   │   ├── database.py      ← SQLAlchemy or JSON file store
│   │   │   ├── routes/
│   │   │   │   ├── layout.py
│   │   │   │   ├── modules.py
│   │   │   │   └── settings.py
│   │   │   └── schemas/         ← JSON schemas for validation
│   │   ├── data/                ← Volume mount for persistence
│   │   └── tests/
│   │
│   └── websocket/               ← Redis Pub/Sub ↔ WebSocket Bridge
│       ├── Dockerfile
│       ├── package.json
│       ├── src/
│       │   ├── server.ts        ← Socket.io server
│       │   └── redis-bridge.ts  ← Pub/sub forwarding
│       └── tests/
│
├── modules/                     ← Module Containers
│   ├── clock/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── server.ts        ← Express server
│   │   │   ├── routes.ts        ← /health, /manifest, /data, /action
│   │   │   ├── redis.ts         ← Redis client (pub/sub)
│   │   │   ├── config.ts        ← Fetch from Config Service
│   │   │   └── state.ts         ← State management
│   │   ├── data/                ← Volume mount (SQLite/JSON)
│   │   └── tests/
│   │
│   ├── weather/
│   │   ├── Dockerfile
│   │   ├── requirements.txt     ← FastAPI
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── routes.py
│   │   │   ├── redis_client.py
│   │   │   ├── weather_api.py   ← External API integration
│   │   │   └── state.py
│   │   ├── data/
│   │   └── tests/
│   │
│   ├── calendar/
│   │   └── ... (similar structure)
│   ├── rss/
│   │   └── ...
│   ├── system_stats/
│   │   └── ...
│   └── ... (other modules)
│
├── scripts/
│   ├── setup-pi.sh              ← Raspberry Pi setup script
│   ├── generate-ssl.sh          ← Self-signed cert generation
│   └── backup-config.sh         ← Backup Config Service data
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MODULE_DEVELOPMENT.md    ← Guide for creating new modules
│   ├── API.md                   ← REST API reference
│   └── DEPLOYMENT.md            ← Pi deployment guide
│
└── README.md
```

### 10.1 Docker Compose Configuration Example

```yaml
# docker-compose.yml

version: '3.8'

services:
  # API Gateway
  gateway:
    image: nginx:alpine
    container_name: ozmirror-gateway
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - ui
      - config-service
      - websocket-bridge
    restart: unless-stopped

  # UI Container (React SPA)
  ui:
    build: ./ui
    container_name: ozmirror-ui
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  # Configuration Service
  config-service:
    build: ./services/config
    container_name: ozmirror-config
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/ozmirror
      - REDIS_URL=redis://redis:6379
    volumes:
      - config-data:/app/data
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # PostgreSQL (for Config Service)
  postgres:
    image: postgres:15-alpine
    container_name: ozmirror-postgres
    environment:
      - POSTGRES_DB=ozmirror
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  # Redis (Message Broker)
  redis:
    image: redis:7-alpine
    container_name: ozmirror-redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # WebSocket Bridge (Redis Pub/Sub ↔ WebSocket)
  websocket-bridge:
    build: ./services/websocket
    container_name: ozmirror-websocket
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=8080
    depends_on:
      - redis
    restart: unless-stopped

  # Module: Clock
  clock-module:
    build: ./modules/clock
    container_name: ozmirror-clock
    environment:
      - MODULE_ID=clock
      - CONFIG_SERVICE_URL=http://config-service:8000
      - REDIS_URL=redis://redis:6379
      - PORT=3001
    volumes:
      - clock-data:/app/data
    depends_on:
      - redis
      - config-service
    restart: unless-stopped

  # Module: Weather
  weather-module:
    build: ./modules/weather
    container_name: ozmirror-weather
    environment:
      - MODULE_ID=weather
      - CONFIG_SERVICE_URL=http://config-service:8000
      - REDIS_URL=redis://redis:6379
      - WEATHER_API_KEY=${WEATHER_API_KEY}
      - PORT=3002
    volumes:
      - weather-data:/app/data
    depends_on:
      - redis
      - config-service
    restart: unless-stopped

  # Module: Calendar
  calendar-module:
    build: ./modules/calendar
    container_name: ozmirror-calendar
    environment:
      - MODULE_ID=calendar
      - CONFIG_SERVICE_URL=http://config-service:8000
      - REDIS_URL=redis://redis:6379
      - PORT=3003
    volumes:
      - calendar-data:/app/data
    depends_on:
      - redis
      - config-service
    restart: unless-stopped

  # Add more modules as needed...

volumes:
  config-data:
  postgres-data:
  redis-data:
  clock-data:
  weather-data:
  calendar-data:

networks:
  default:
    name: ozmirror-network
```

---

## 11. Performance Requirements

### 11.1 Raspberry Pi 4 (Single Node)

| Metric | Target |
|--------|--------|
| Cold start (all containers) to UI interactive | < 15 seconds |
| UI load time (React SPA) | < 2 seconds |
| Layout drag frame rate | ≥ 30 fps |
| Total memory usage (5 modules + core services) | < 1.5 GB RAM |
| CPU usage (idle) | < 15% |
| Module container startup time | < 3 seconds per module |
| REST API response time (P95) | < 100ms |
| WebSocket message latency | < 50ms |
| Config Service read/write | < 50ms |
| Redis pub/sub latency | < 10ms |

### 11.2 Resource Allocation (Docker Limits - Pi 4 with 4GB RAM)

| Service | Memory Limit | CPU Limit |
|---------|--------------|-----------|
| UI Container (Nginx) | 128 MB | 0.5 cores |
| API Gateway (Nginx) | 64 MB | 0.5 cores |
| Config Service | 256 MB | 1.0 cores |
| Redis | 128 MB | 0.5 cores |
| WebSocket Bridge | 128 MB | 0.5 cores |
| Each Module Container | 64-128 MB | 0.25 cores |

### 11.3 Network

| Metric | Target |
|--------|--------|
| UI → Module API latency (localhost) | < 5ms |
| Redis pub/sub throughput | > 1000 msg/sec |
| Concurrent WebSocket connections | ≥ 10 (for multi-device access) |

### 11.4 Scalability

| Deployment Type | Max Modules | Notes |
|----------------|-------------|-------|
| Single Pi 4 (4GB) | 10-15 modules | Depends on module complexity |
| Single Pi 4 (8GB) | 20-25 modules | More headroom for heavy modules |
| Distributed (3x Pi 4) | 50+ modules | Spread across nodes |
| Cloud/NUC | 100+ modules | No practical limit |

---

## 12. Build & Deployment

### 12.1 Development

```bash
# Start all services with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or start individual services
cd ui && npm run dev                    # Frontend (Vite HMR on port 5173)
cd services/config && python main.py    # Config Service
cd modules/clock && npm run dev         # Clock module

# Run tests
docker-compose run ui npm test                     # UI tests
docker-compose run config-service pytest           # Config service tests
docker-compose run clock-module npm test           # Module tests

# Lint
docker-compose run ui npm run lint
```

### 12.2 Production Build

```bash
# Build all Docker images
docker-compose build

# Or build individually
docker build -t ozmirror/ui:latest ./ui
docker build -t ozmirror/config:latest ./services/config
docker build -t ozmirror/clock:latest ./modules/clock
docker build -t ozmirror/weather:latest ./modules/weather

# Push to registry (optional, for distributed deployments)
docker-compose push
```

### 12.3 Raspberry Pi 4 Deployment (Single Node)

#### 12.3.1 Prerequisites

```bash
# Install Docker & Docker Compose on Raspberry Pi OS (64-bit)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose V2
sudo apt-get install docker-compose-plugin

# Reboot
sudo reboot
```

#### 12.3.2 Deploy OzMirror

```bash
# Clone repo or copy files to Pi
cd /opt/ozmirror

# Create .env file
cp .env.example .env
# Edit .env with your API keys, etc.

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Update services
docker-compose pull
docker-compose up -d
```

#### 12.3.3 Kiosk Mode Setup

```bash
# Install Chromium
sudo apt-get install chromium-browser unclutter

# Create kiosk launcher script
cat > ~/start-ozmirror-kiosk.sh <<'EOF'
#!/bin/bash
xset s off         # Disable screensaver
xset -dpms         # Disable power saving
xset s noblank     # Don't blank the screen
unclutter -idle 3 &  # Hide cursor after 3s

chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  http://localhost:80
EOF

chmod +x ~/start-ozmirror-kiosk.sh

# Auto-start on boot
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/ozmirror.desktop <<EOF
[Desktop Entry]
Type=Application
Name=OzMirror Kiosk
Exec=/home/pi/start-ozmirror-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
```

#### 12.3.4 Systemd Service (Alternative)

```bash
sudo cat > /etc/systemd/system/ozmirror.service <<EOF
[Unit]
Description=OzMirror Smart Display
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ozmirror
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=pi

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable ozmirror
sudo systemctl start ozmirror
```

### 12.4 Distributed Deployment (K3s Cluster)

For deployments across multiple nodes (e.g., multiple Raspberry Pis or a hybrid Pi + cloud setup):

```bash
# Install K3s on master node
curl -sfL https://get.k3s.io | sh -

# Get node token
sudo cat /var/lib/rancher/k3s/server/node-token

# Join worker nodes
curl -sfL https://get.k3s.io | K3S_URL=https://master-ip:6443 \
  K3S_TOKEN=<token> sh -

# Deploy with Helm or kubectl
kubectl apply -f k8s/
```

### 12.5 Update Strategy

```bash
# Pull latest images
docker-compose pull

# Rolling restart (zero downtime)
docker-compose up -d --no-deps --build <service-name>

# Or restart all
docker-compose down && docker-compose up -d
```

### 12.6 Backup & Restore

```bash
# Backup config data
docker-compose exec config-service tar czf /tmp/config-backup.tar.gz /app/data
docker cp ozmirror-config:/tmp/config-backup.tar.gz ./backups/

# Backup module data
docker-compose exec clock-module tar czf /tmp/clock-data.tar.gz /app/data
docker cp ozmirror-clock:/tmp/clock-data.tar.gz ./backups/

# Restore
docker cp ./backups/config-backup.tar.gz ozmirror-config:/tmp/
docker-compose exec config-service tar xzf /tmp/config-backup.tar.gz -C /
docker-compose restart config-service
```

---

## 13. Future Considerations (v2+)

- **Module marketplace** — Docker Hub-based registry with curated modules, one-click install via UI
- **Multi-profile scheduling** — auto-switch layouts on a time-based schedule (cron-like)
- **Remote management** — mobile app (React Native) to configure the mirror from phones/tablets
- **Voice control** — Whisper.cpp wake word detection + command routing to modules
- **Multi-display support** — span or mirror across multiple screens (multiple UI containers)
- **Cloud sync** — backup/restore layout configs to S3/Dropbox/GitHub
- **Module scaling** — horizontal scaling of individual modules based on load (K8s HPA)
- **Edge analytics** — on-device ML models for presence detection, gesture recognition
- **Inter-module communication** — direct module-to-module communication beyond pub/sub (gRPC)
- **Plugin system** — custom middleware/hooks for advanced users
- **A/B testing** — test different layouts/configs and track user engagement
- **Offline mode** — graceful degradation when internet is unavailable

---

## 14. Open Questions

### 14.1 Architecture & Security

- ❓ Should module configs be encrypted at rest, or is plain JSON acceptable?
- ❓ Should we implement authentication/authorization for the REST APIs? (e.g., API keys, JWT tokens)
- ❓ Should Redis require authentication (ACLs) or run in trusted network mode?
- ❓ Should module containers run as non-root users for better security?
- ❓ What's the strategy for secrets management (API keys)? Docker secrets, .env files, or external vault?

### 14.2 Data & State

- ❓ Should the Config Service use PostgreSQL or stick with JSON files for simplicity on Pi?
- ❓ Should modules share a single Redis instance or have dedicated instances?
- ❓ Should module state be backed up automatically, or is manual backup acceptable?
- ❓ What's the data retention policy for module logs and historical data?

### 14.3 Deployment & Updates

- ❓ What is the update delivery mechanism for Docker images? Docker Hub, self-hosted registry, or GitHub Container Registry?
- ❓ Should we support automatic updates, or require manual `docker-compose pull`?
- ❓ Should the system support rollback to previous versions if an update fails?
- ❓ What's the minimum supported Raspberry Pi version? (Pi 3B+ @ 1GB RAM vs Pi 4 @ 4GB RAM)

### 14.4 Features & UX

- ❓ Should layout profiles support time-based auto-switching in v1 or defer to v2?
- ❓ Should the UI support multi-user accounts, or is single-user sufficient for v1?
- ❓ Should modules be sandboxed (resource limits, network isolation) or trust the module developer?
- ❓ Should the system support remote access from other devices on the LAN, or restrict to localhost only?

### 14.5 Monitoring & Observability

- ❓ Should we include Prometheus + Grafana for monitoring in v1, or defer to v2?
- ❓ Should module containers emit structured logs (JSON) or plain text?
- ❓ Should we implement distributed tracing (OpenTelemetry) for debugging inter-service calls?
- ❓ What's the strategy for alerting if a module container crashes?