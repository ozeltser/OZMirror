# Architecture Overview

OZMirror is a distributed smart display platform built on Docker microservices. Every service runs in its own container, communicating through REST APIs, Redis pub/sub, and WebSocket connections. The system is designed to run on a single Raspberry Pi 4 (4GB+) or scale across multiple nodes.

## High-Level Architecture

```
                          +---------------------------+
                          |    Browser / Kiosk         |
                          |    (Chromium fullscreen)   |
                          +------------+--------------+
                                       | HTTPS
                                       v
+----------------------------------------------------------------------+
|                    Nginx API Gateway (:80/:443)                      |
|                                                                      |
|  /              --> UI Container (React SPA)                         |
|  /api/config/*  --> Config Service (FastAPI)                         |
|  /api/modules/* --> Module Containers (dynamic routing)              |
|  /ws            --> WebSocket Bridge (Socket.IO)                     |
+------+-------------------+-------------------+-----------------------+
       |                   |                   |
       v                   v                   v
+-------------+   +-----------------+   +-------------------+
| UI          |   | Config Service  |   | WebSocket Bridge  |
| Container   |   | (FastAPI)       |   | (Socket.IO)       |
| React 18    |   | :8000           |   | :8080             |
| Vite build  |   |                 |   |                   |
| served by   |   | +------+        |   | +-------+         |
| Nginx :80   |   | | MySQL|        |   | | Redis |         |
+-------------+   +-+------+--------+   +-+-------+---------+
                        |                     |
                        v                     v
                  +----------+          +-----------+
                  |  MySQL   |          |   Redis   |
                  |  :3306   |          |   :6379   |
                  +----------+          +-----+-----+
                                              |
            +-----------+-----------+---------+---------+-----------+
            |           |           |         |         |           |
            v           v           v         v         v           v
        +-------+  +--------+  +--------+  +----+  +--------+  +-------+
        | Clock |  | Weather|  |Calendar|  | RSS|  | Sys    |  |Sticky |
        | :3001 |  | :3001  |  | :3001  |  |:3001| | Stats  |  | Notes |
        +-------+  +--------+  +--------+  +----+  | :3001  |  | :3001 |
                                                    +--------+  +-------+
        Each module container listens on :3001 internally.
        Nginx routes to <module_id>-module:3001 using Docker DNS.
```

## Services

### Nginx API Gateway

| Property | Value |
|----------|-------|
| Container | `ozmirror-gateway` |
| Ports | 80 (HTTP, redirects to HTTPS), 443 (HTTPS) |
| Config | `nginx/nginx.conf` |

Responsibilities:
- SSL termination (TLS 1.2/1.3 with Mozilla Intermediate cipher suite)
- CORS enforcement via an origin allowlist (`map $http_origin`)
- API key injection: adds `X-API-Key` header to upstream requests so the browser never sees the secret
- Dynamic module routing: `/api/modules/<id>/<path>` resolves to `<id>-module:3001` via Docker DNS
- Proxies `/api/config/*` to Config Service, `/ws` to WebSocket Bridge, and `/` to UI Container
- Gzip compression for text/JSON assets

### UI Container

| Property | Value |
|----------|-------|
| Container | `ozmirror-ui` |
| Tech | React 18, TypeScript, Vite, Zustand, react-grid-layout |
| Internal port | 80 (served by Nginx inside the container) |
| Source | `ui/` |

The frontend SPA. Features include:
- Drag-and-drop layout canvas with `react-grid-layout`
- Module picker drawer for adding widgets
- Settings panel for themes, kiosk mode, font scale
- Edit toolbar with keyboard shortcuts (E, Esc, F, Ctrl+S, Ctrl+,)
- WebSocket client for real-time module data
- REST polling fallback via React Query

### Config Service

| Property | Value |
|----------|-------|
| Container | `ozmirror-config` |
| Tech | FastAPI (Python), SQLAlchemy, MySQL |
| Internal port | 8000 |
| Source | `services/config/` |

Central configuration store. Manages:
- **Layout profiles** -- named grid arrangements with per-instance module configs
- **Module registry** -- modules self-register on startup; UI queries the registry to discover available widgets
- **Global settings** -- theme, kiosk mode, cursor timeout, font scale
- **Themes** -- built-in (dark, light, AMOLED) and user-created themes

Authentication: `X-API-Key` header required on all write operations (PUT, POST, DELETE). Read operations are open.

Auto-generated API docs available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when the service is running.

### WebSocket Bridge

| Property | Value |
|----------|-------|
| Container | `ozmirror-websocket` |
| Tech | Node.js, Socket.IO, ioredis |
| Internal port | 8080 |
| Source | `services/websocket/` |

Bridges Redis pub/sub channels to browser clients over WebSocket:
- Authenticates every connection with `X-API-Key` (injected by Nginx) using timing-safe comparison
- Enforces a channel whitelist: only `module:<name>:<detail>` channels are accessible
- Per-socket handler tracking prevents memory leaks on disconnect
- Supports subscribe, unsubscribe, and publish events from clients

### Redis

| Property | Value |
|----------|-------|
| Container | `ozmirror-redis` |
| Image | `redis:7-alpine` |
| Internal port | 6379 |

Pub/sub message broker between module containers and the WebSocket Bridge. Password-protected. Persistence enabled (`appendonly yes`). See [REDIS_CHANNELS.md](REDIS_CHANNELS.md) for the full channel naming convention.

### MySQL

| Property | Value |
|----------|-------|
| Container | `ozmirror-mysql` |
| Image | `mysql:8.0` |
| Internal port | 3306 |

Persistent storage for the Config Service. Stores layouts, module registry, settings, and themes. Data is stored in a Docker volume (`mysql-data`).

### Module Containers

Six bundled modules, each a Node.js/Express application in its own container:

| Module | Container | Directory | Description |
|--------|-----------|-----------|-------------|
| clock | `ozmirror-clock` | `modules/clock/` | Digital clock with timezone support |
| weather | `ozmirror-weather` | `modules/weather/` | Current weather + forecast (OpenWeatherMap) |
| calendar | `ozmirror-calendar` | `modules/calendar/` | Upcoming events (iCal/Google Calendar) |
| rss | `ozmirror-rss` | `modules/rss/` | RSS/Atom feed reader |
| system_stats | `ozmirror-system-stats` | `modules/system-stats/` | CPU, memory, disk usage |
| sticky_notes | `ozmirror-sticky-notes` | `modules/sticky-notes/` | Editable text notes |

Every module:
- Listens on port 3001 inside its container
- Exposes `/health`, `/manifest`, `/data` REST endpoints
- Registers with Config Service on startup (POST `/api/config/modules/register`)
- Publishes data updates to Redis (`module:<id>:<detail>` channels)
- Fetches per-instance config from Config Service

## Communication Patterns

### 1. REST API (synchronous)

```
Browser --HTTP--> Nginx --proxy--> Config Service
Browser --HTTP--> Nginx --proxy--> Module Container
Module  --HTTP--> Config Service (registration, config fetch)
```

All REST calls from the browser pass through Nginx, which injects the API key. Module containers communicate directly with the Config Service over the Docker network.

### 2. WebSocket (real-time push)

```
Browser <--Socket.IO--> Nginx --proxy--> WebSocket Bridge <--Redis pub/sub--> Module Containers
```

The browser opens a Socket.IO connection to `/ws`. The WebSocket Bridge subscribes to Redis channels on behalf of the client and pushes messages as they arrive.

### 3. Redis Pub/Sub (inter-service messaging)

```
Module Container --publish--> Redis --deliver--> WebSocket Bridge --emit--> Browser
```

Modules publish data updates (e.g., `module:clock:time`) to Redis. The WebSocket Bridge subscribes to these channels and forwards messages to connected browsers.

## Data Flow: Module Update to Browser

Here is the complete path a module data update takes to reach the user's screen:

```
1. Clock module builds time data
2. Clock module publishes to Redis channel "module:clock:time"
   Payload: { instanceId: "clock_01", data: { time: "14:32:05", ... }, timestamp: ... }
3. Redis delivers message to all subscribers of "module:clock:time"
4. WebSocket Bridge receives the message
5. Bridge emits Socket.IO "message" event to all sockets subscribed to that channel
   Payload: { channel: "module:clock:time", payload: <parsed message> }
6. Browser's WebSocket client receives the event
7. React component updates via state/store, re-rendering the widget
```

For REST-polled data (initial load or fallback):

```
1. Browser sends GET /api/modules/clock/data?instanceId=clock_01
2. Nginx routes to clock-module:3001/data?instanceId=clock_01
3. Clock module fetches instance config from Config Service
4. Clock module builds time data and returns JSON response
5. React Query caches the response; component renders
```

## Docker Compose Service Map

All services are defined in `docker-compose.yml` and connected via a single bridge network:

```
Network: ozmirror-network (bridge)

Services:
  gateway          --> depends on: ui, config-service, websocket-bridge
  ui               --> no dependencies
  config-service   --> depends on: mysql
  mysql            --> no dependencies
  redis            --> no dependencies
  websocket-bridge --> depends on: redis
  clock-module     --> depends on: redis, config-service
  weather-module   --> depends on: redis, config-service
  calendar-module  --> depends on: redis, config-service
  rss-module       --> depends on: redis, config-service
  system_stats-module --> depends on: redis, config-service
  sticky_notes-module --> depends on: redis, config-service

Volumes:
  mysql-data        -- MySQL data files
  redis-data        -- Redis AOF persistence
  clock-data        -- Clock module persistent data
  sticky-notes-data -- Sticky notes persistent data
```

## Network Topology

All containers share `ozmirror-network` (Docker bridge). Only the gateway exposes host ports:

| Service | Host Port | Container Port | Protocol |
|---------|-----------|----------------|----------|
| gateway | 80 | 80 | HTTP (redirects to HTTPS) |
| gateway | 443 | 443 | HTTPS |

All other services communicate exclusively over the Docker network using container DNS names (e.g., `config-service:8000`, `redis:6379`, `clock-module:3001`).

## Related Documentation

- [API Reference](API.md) -- REST and WebSocket endpoint details
- [Module Development Guide](MODULE_DEVELOPMENT.md) -- how to build new modules
- [Redis Channels](REDIS_CHANNELS.md) -- pub/sub channel naming convention
- [Deployment Guide](DEPLOYMENT.md) -- setup and deployment instructions
- [Security Requirements](SECURITY_REQUIREMENTS.md) -- authentication, CORS, input validation
