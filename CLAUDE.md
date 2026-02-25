# OZMirror — Claude Code Guidelines

## Session Start

At the beginning of every new session:

1. Run `git fetch origin && git checkout main && git pull origin main` to ensure you are working from the latest `main`
2. Read the key source files before making any changes — at minimum: `CLAUDE.md`, `ui/src/`, `services/config/app/`, `services/websocket/src/`, and any files directly relevant to the task

---

## Repository Structure

```
OZMirror/
├── ui/                        # React 18 SPA (TypeScript, Vite, Zustand)
│   └── src/
│       ├── App.tsx            # Root component — theming, keyboard shortcuts, gesture handler
│       ├── components/        # Canvas, EditToolbar, ModulePicker, SettingsPanel
│       ├── core/              # WebSocketClient, InputHandler, GestureHandler
│       ├── hooks/             # useLayout, useConfig, useModuleData, useModuleEvents
│       ├── store/             # appStore (Zustand)
│       ├── types/             # Shared TypeScript interfaces (GridItem, LayoutData, etc.)
│       ├── utils/             # theme.ts
│       └── widgets/           # One <Name>Widget.tsx + .module.css per module
├── services/
│   ├── config/                # FastAPI (Python) — layout, modules registry, settings, themes
│   │   ├── app/               # main.py, models.py, database.py, dependencies.py
│   │   │   └── routes/        # layout.py, modules.py, settings.py, validate.py
│   │   └── tests/             # pytest test suite
│   └── websocket/             # Node.js Socket.IO bridge — Redis ↔ browser
│       └── src/               # server.ts, redis-bridge.ts, logger.ts
├── modules/                   # One directory per widget backend (Node.js/Express/TypeScript)
│   ├── clock/
│   ├── weather/
│   ├── calendar/
│   ├── rss/
│   ├── system-stats/
│   └── sticky-notes/
│       └── src/               # server.ts, routes.ts, manifest.ts, config-client.ts, redis-client.ts
├── nginx/
│   ├── nginx.conf             # Production: SSL termination, CORS, API key injection, routing
│   └── nginx.dev.conf         # Development: HTTP-only, no SSL required
├── scripts/                   # setup-pi.sh, start-kiosk.sh, generate-ssl.sh, backup-config.sh
├── docs/                      # ARCHITECTURE.md, API.md, MODULE_DEVELOPMENT.md, REDIS_CHANNELS.md, DEPLOYMENT.md
├── docker-compose.yml         # Production stack definition
├── docker-compose.dev.yml     # Dev overrides (hot reload, port exposure, debug logging)
├── Makefile                   # Convenience targets (deploy, build, restart, logs, etc.)
└── .env.example               # Template for required environment variables
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Zustand, react-grid-layout, Socket.IO client |
| Config Service | FastAPI (Python 3.11), SQLAlchemy 2, MySQL 8, Pydantic v2 |
| WebSocket Bridge | Node.js, Socket.IO, ioredis |
| Module backends | Node.js, Express, TypeScript, Redis client |
| Message broker | Redis 7 (pub/sub + AOF persistence) |
| Database | MySQL 8 (layout profiles, module registry, settings, themes) |
| API Gateway | Nginx (SSL termination, CORS, API key injection, dynamic module routing) |
| Container runtime | Docker Compose |
| CI/CD | GitHub Actions → self-hosted Raspberry Pi runner |

---

## Docker Services

All services run on the `ozmirror-network` bridge. Only the gateway exposes host ports.

| Service | Container | Internal Port | Source |
|---|---|---|---|
| gateway | ozmirror-gateway | 80 / 443 (host) | `nginx/` |
| ui | ozmirror-ui | 80 | `ui/` |
| config-service | ozmirror-config | 8000 | `services/config/` |
| websocket-bridge | ozmirror-websocket | 8080 | `services/websocket/` |
| mysql | ozmirror-mysql | 3306 | image: mysql:8.0 |
| redis | ozmirror-redis | 6379 | image: redis:7-alpine |
| clock-module | ozmirror-clock | 3001 | `modules/clock/` |
| weather-module | ozmirror-weather | 3001 | `modules/weather/` |
| calendar-module | ozmirror-calendar | 3001 | `modules/calendar/` |
| rss-module | ozmirror-rss | 3001 | `modules/rss/` |
| system_stats-module | ozmirror-system-stats | 3001 | `modules/system-stats/` |
| sticky_notes-module | ozmirror-sticky-notes | 3001 | `modules/sticky-notes/` |

**Startup dependency order:** mysql → config-service → (redis → websocket-bridge, all module containers) → gateway

---

## Branching & PRs

- **Never commit directly to `main`**
- All changes must go through a feature/fix branch and a pull request
- Branch naming: `fix/<short-description>`, `feat/<short-description>`, `chore/<short-description>`
- Create the PR with `gh pr create` after pushing the branch

---

## Environment Setup

Copy `.env.example` to `.env` and fill in all values before starting:

```bash
cp .env.example .env
```

Key variables:

| Variable | Purpose |
|---|---|
| `API_KEY` | Shared secret — injected by Nginx into all upstream requests; never reaches the browser |
| `REDIS_PASSWORD` | Redis authentication password |
| `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | MySQL credentials |
| `ALLOWED_ORIGINS` | Comma-separated origins for Config Service CORS |
| `ALLOWED_CORS_ORIGINS` | Comma-separated origins for WebSocket Bridge CORS |
| `WEATHER_API_KEY` | OpenWeatherMap API key (weather module only) |
| `CONFIG_SERVICE_URL` | Internal URL used by module containers: `http://config-service:8000` |

---

## Development Workflow

### Running in development mode

```bash
# Start the full stack with hot-reload enabled
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# The dev overrides:
# - ui: Vite dev server on :5173 (src/ bind-mounted)
# - config-service: uvicorn --reload (app/ bind-mounted)
# - websocket-bridge: src/ bind-mounted, debug logging
# - mysql: port 3306 exposed for GUI tools (TablePlus, DBeaver)
# - nginx: uses nginx.dev.conf (HTTP only, no SSL certs needed)
```

SSL certificates are only needed in production. The dev nginx config skips them.

### Running tests locally

```bash
# Config Service (pytest)
cd services/config && pip install -r requirements.txt -r tests/requirements-test.txt
pytest

# UI (Vitest)
cd ui && npm ci && npm test

# Any module backend (Vitest)
cd modules/clock && npm ci && npm test
```

---

## Deployment

The server runs on a dedicated Linux machine (Raspberry Pi 4). Always use `make deploy` after pulling new code — it rebuilds images so code changes take effect.

```bash
make deploy        # git pull + rebuild all images + restart (use after every git pull)
make build         # rebuild images without restarting
make restart       # restart containers without rebuilding (config/env changes only)
make down          # stop and remove all containers (volumes preserved)
make ps            # show container status
make logs          # tail all service logs
make logs-gateway  # tail gateway logs
make logs-config   # tail config-service logs
make logs-ui       # tail ui logs
make logs-ws       # tail websocket-bridge logs
```

**Never use `docker compose up` directly** — it does not rebuild images, so code changes will not be picked up.

### CI/CD

GitHub Actions runs on every push/PR to `main`:
1. **test-config** — pytest in `services/config/`
2. **test-ui** — `npm test` in `ui/`
3. **test-modules** — `npm test` in each `modules/<name>/` (matrix)
4. **deploy** — runs `make deploy` on the self-hosted Pi runner (main branch merges only, after all tests pass)

---

## CORS

The dashboard is accessed at `https://ozmirror.azuriki.com`. Any new domain or IP that needs write access (`PUT`/`DELETE`) must be added to **both**:

1. `ALLOWED_ORIGINS` and `ALLOWED_CORS_ORIGINS` in `.env`
2. The `map $http_origin $allow_origin` block in `nginx/nginx.conf`

Omitting either causes layout saves to silently fail with a `422` response.

Private/LAN IP ranges (RFC 1918: `192.168.*`, `10.*`, `172.16–31.*`) are already allowed in `nginx.conf` so the mirror works from any device on the local network.

---

## Authentication

- All **write operations** (`PUT`, `POST`, `DELETE`) to the Config Service and module endpoints require an `X-API-Key` header.
- **Read operations** (`GET`) are open and require no authentication.
- The Nginx gateway injects `X-API-Key` from the `API_KEY` environment variable into every proxied request. The browser never sees the key.
- The WebSocket Bridge also validates `X-API-Key` (injected by Nginx) on every Socket.IO connection. Unauthenticated sockets are rejected immediately.

---

## API Routes

Nginx routes incoming requests:

| Path | Upstream |
|---|---|
| `/api/config/*` | `config-service:8000` |
| `/api/modules/<id>/*` | `<id>-module:3001` (Docker DNS resolution) |
| `/ws` | `websocket-bridge:8080` |
| `/*` | `ui:80` (React SPA) |

Config Service auto-generates Swagger docs at `/docs` and ReDoc at `/redoc` when running.

---

## Module Architecture

Every module is a self-contained Express/TypeScript container. Required source files:

| File | Purpose |
|---|---|
| `src/server.ts` | Entry point — starts Express, connects Redis, registers with Config Service |
| `src/routes.ts` | `GET /health`, `GET /manifest`, `GET /data?instanceId=<id>` |
| `src/manifest.ts` | Module metadata, `configSchema` (JSON Schema), `gridConstraints` |
| `src/config-client.ts` | Registration (POST to Config Service on startup with retry), instance config fetch |
| `src/redis-client.ts` | Redis publisher — publishes `module:<id>:<detail>` channels on a timer |
| `Dockerfile` | Multi-stage build (`node:18-alpine` builder + production image) |

**Lifecycle:**
1. Start Express on port 3001
2. Connect to Redis, begin publishing on a timer
3. Register with Config Service (fire-and-forget, exponential back-off, up to 5 retries)
4. On `SIGTERM`/`SIGINT`: stop publishing, close Redis, shut down Express gracefully

### Adding a new module

1. Create `modules/<name>/` with all required files (use `modules/clock/` as reference)
2. Add the service to `docker-compose.yml` — container name must be `<module_id>-module`
3. Add the module ID to the `ALLOWED_MODULE_CHANNELS` regex in `services/websocket/src/server.ts`
4. Update `docs/REDIS_CHANNELS.md` with the new channel pattern
5. Create the UI widget in `ui/src/widgets/<Name>Widget.tsx` + `.module.css`
6. Run `make deploy`

Full checklist and example code in `docs/MODULE_DEVELOPMENT.md`.

---

## Redis Channels

Pattern: `<scope>:<module_or_subsystem>:<detail>`

| Scope | Accessible via WebSocket | Purpose |
|---|---|---|
| `module:<name>:<detail>` | Yes | Real-time module data (subscribe + publish) |
| `events:system` | No | Internal control-plane events |
| `events:ui` | No | Internal UI interaction events |
| `events:modules:<name>` | No | Module lifecycle / heartbeat |

Module payload format:
```json
{ "instanceId": "clock_01", "data": { /* module-specific */ }, "timestamp": 1708012345000 }
```

WebSocket Bridge channel whitelist (regex in `services/websocket/src/server.ts`):
```
^module:(clock|weather|calendar|rss|system_stats|now_playing|sticky_notes):.+$
```

---

## UI Keyboard Shortcuts

| Key | Action |
|---|---|
| `E` | Toggle edit mode |
| `Esc` | Exit edit mode |
| `F` | Toggle fullscreen |
| `Ctrl+S` | Save layout |
| `Ctrl+,` | Open/close settings panel |
| `Ctrl+Z` | Undo last layout change |

Touch gestures: long press → edit mode, two-finger swipe down → settings panel.

---

## Key Conventions

- **Module container naming:** The Docker Compose service name must be `<module_id>-module` (e.g., `clock-module`). Nginx resolves module routes using Docker DNS as `<module_id>-module:3001`.
- **Instance IDs:** Widget instances use IDs like `clock_01`, `weather_01`. The `instanceId` is the key in `moduleConfigs` within a layout profile.
- **Config Service seeding:** On startup, `seed_defaults` creates the `default` layout profile and default global settings if they don't exist. This is idempotent.
- **Layout save:** The UI debounces layout persistence (800 ms) during drag/resize to avoid hammering the API. Ctrl+S saves immediately.
- **TypeScript strict mode:** All TypeScript packages use `"strict": true`. Do not downgrade this.
- **No direct `docker compose up`:** Always use `make deploy` on the server to ensure image rebuilds.

---

## Related Documentation

- `docs/ARCHITECTURE.md` — full system design with ASCII diagrams and data flow
- `docs/API.md` — complete REST and WebSocket endpoint reference
- `docs/MODULE_DEVELOPMENT.md` — step-by-step guide and Hello World example for new modules
- `docs/REDIS_CHANNELS.md` — channel naming convention and security model
- `docs/DEPLOYMENT.md` — server setup and production deployment instructions
- `docs/SECURITY_REQUIREMENTS.md` — authentication, CORS, input validation details
