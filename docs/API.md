# API Reference

This document covers all REST and WebSocket endpoints exposed by OZMirror services.

## Authentication

Write operations (PUT, POST, DELETE) require an `X-API-Key` header. For browser requests, the Nginx gateway injects this header automatically so the API key never reaches the client. Module containers include the key when registering with the Config Service.

Read operations (GET) do not require authentication.

```
X-API-Key: <your-api-key>
```

The API key is set via the `API_KEY` environment variable in `.env`.

## Config Service API

**Base path**: `/api/config`
**Internal port**: 8000
**Tech**: FastAPI (Python)
**Auto-generated docs**: `/docs` (Swagger UI), `/redoc` (ReDoc)

### Health Check

```
GET /health
```

Response `200`:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 1234.56
}
```

---

### Layout Management

#### Get Layout

Returns the full layout document including all profiles and the active profile name.

```
GET /api/config/layout
```

Response `200`:
```json
{
  "activeProfile": "default",
  "layouts": {
    "default": {
      "grid": [
        { "i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3, "minW": null, "minH": null, "maxW": null, "maxH": null }
      ],
      "moduleConfigs": {
        "clock_01": {
          "moduleId": "clock",
          "config": { "format": "HH:mm:ss", "timezone": "UTC", "showDate": true }
        }
      }
    }
  }
}
```

#### Save Layout

Upserts a profile's grid and module configs. Other profiles are not modified.

```
PUT /api/config/layout
```

Requires: `X-API-Key`

Request body:
```json
{
  "profileName": "default",
  "grid": [
    { "i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3 }
  ],
  "moduleConfigs": {
    "clock_01": {
      "moduleId": "clock",
      "config": { "format": "HH:mm", "timezone": "America/New_York", "showDate": true }
    }
  }
}
```

Response `200`:
```json
{ "success": true }
```

#### List Profiles

Returns names of all saved layout profiles.

```
GET /api/config/layout/profiles
```

Response `200`:
```json
["default", "morning", "night"]
```

#### Create Profile

Creates a new profile, optionally cloning an existing one.

```
POST /api/config/layout/profiles
```

Requires: `X-API-Key`

Request body:
```json
{
  "name": "morning",
  "copyFrom": "default"
}
```

Response `201`:
```json
{ "success": true }
```

Errors:
- `409 Conflict` -- profile name already exists
- `404 Not Found` -- source profile (`copyFrom`) not found

#### Delete Profile

Deletes a layout profile. The "default" profile cannot be deleted. If the deleted profile was active, the active profile resets to "default".

```
DELETE /api/config/layout/profiles/:name
```

Requires: `X-API-Key`

Response `200`:
```json
{ "success": true }
```

Errors:
- `400 Bad Request` -- attempting to delete the "default" profile
- `404 Not Found` -- profile not found

---

### Module Registry

#### List Modules

Returns all registered modules.

```
GET /api/config/modules
```

Response `200`:
```json
[
  {
    "id": "clock",
    "name": "Clock",
    "serviceUrl": "http://clock-module:3001",
    "manifest": {
      "id": "clock",
      "name": "Clock",
      "description": "Digital clock with configurable format and timezone support",
      "version": "1.0.0",
      "author": "OzMirror",
      "icon": "clock",
      "defaultConfig": { "format": "HH:mm:ss", "timezone": "UTC", "showDate": true },
      "configSchema": { "type": "object", "properties": { /* ... */ } },
      "gridConstraints": { "minW": 2, "minH": 2, "maxW": 8, "maxH": 4, "defaultW": 4, "defaultH": 3 }
    },
    "status": "online"
  }
]
```

#### Get Module

Returns a specific registered module by ID.

```
GET /api/config/modules/:id
```

Response `200`: Same shape as a single item from the list endpoint.

Errors:
- `404 Not Found` -- module not registered

#### Register Module

Registers or updates a module in the registry. Modules call this on container startup. If the module was already registered, the record is replaced.

```
POST /api/config/modules/register
```

Requires: `X-API-Key`

Request body:
```json
{
  "id": "clock",
  "name": "Clock",
  "serviceUrl": "http://clock-module:3001",
  "manifest": {
    "id": "clock",
    "name": "Clock",
    "description": "Digital clock with configurable format and timezone support",
    "version": "1.0.0",
    "author": "OzMirror",
    "icon": "clock",
    "defaultConfig": { "format": "HH:mm:ss", "timezone": "UTC", "showDate": true },
    "configSchema": { /* JSON Schema */ },
    "gridConstraints": { "minW": 2, "minH": 2, "maxW": 8, "maxH": 4, "defaultW": 4, "defaultH": 3 }
  },
  "status": "online"
}
```

Response `200`:
```json
{ "success": true }
```

#### Get Instance Config

Returns the saved config for one module instance. Falls back to the module's manifest `defaultConfig` if no saved config exists.

```
GET /api/config/modules/:id/config/:instanceId
```

Response `200`:
```json
{
  "format": "HH:mm:ss",
  "timezone": "America/New_York",
  "showDate": true
}
```

Errors:
- `404 Not Found` -- no config and no registered module found

#### Update Instance Config

Replaces the config for a module instance in the active layout profile. Send the full config object, not a partial patch.

```
PUT /api/config/modules/:id/config/:instanceId
```

Requires: `X-API-Key`

Request body (varies per module):
```json
{
  "format": "HH:mm",
  "timezone": "Europe/London",
  "showDate": false
}
```

Response `200`:
```json
{ "success": true }
```

Errors:
- `404 Not Found` -- instance not found in active layout profile

---

### Global Settings

#### Get Settings

Returns global application settings.

```
GET /api/config/settings
```

Response `200`:
```json
{
  "theme": "dark",
  "kiosk": false,
  "cursorTimeout": 3000,
  "fontScale": 1.0,
  "autoStart": false
}
```

#### Update Settings

Replaces global settings. All fields are required.

```
PUT /api/config/settings
```

Requires: `X-API-Key`

Request body:
```json
{
  "theme": "amoled",
  "kiosk": true,
  "cursorTimeout": 5000,
  "fontScale": 1.2,
  "autoStart": true
}
```

Response `200`:
```json
{ "success": true }
```

---

### Themes

#### List Themes

Returns all themes (built-in and custom).

```
GET /api/config/themes
```

Response `200`:
```json
[
  {
    "id": "dark",
    "name": "Dark",
    "variables": {
      "--color-bg": "#1a1a2e",
      "--color-surface": "#16213e",
      "--color-accent": "#0f3460",
      "--color-text": "#e0e8f0"
    }
  },
  {
    "id": "light",
    "name": "Light",
    "variables": { /* ... */ }
  }
]
```

#### Create/Update Theme

Adds a new theme or updates an existing one by ID.

```
POST /api/config/themes
```

Requires: `X-API-Key`

Request body:
```json
{
  "id": "custom",
  "name": "My Custom Theme",
  "variables": {
    "--color-bg": "#000000",
    "--color-surface": "#111111",
    "--color-accent": "#ff6600",
    "--color-text": "#ffffff"
  }
}
```

Response `201`:
```json
{ "success": true }
```

---

## Module REST API

Each module container exposes these endpoints. Nginx routes `/api/modules/<module_id>/<path>` to `<module_id>-module:3001/<path>`.

### Health Check

```
GET /api/modules/:id/health
```

Response `200`:
```json
{
  "status": "healthy",
  "uptime": 12345,
  "version": "1.0.0"
}
```

### Get Manifest

Returns module metadata, config schema, and grid constraints.

```
GET /api/modules/:id/manifest
```

Response `200`:
```json
{
  "id": "clock",
  "name": "Clock",
  "description": "Digital clock with configurable format and timezone support",
  "version": "1.0.0",
  "author": "OzMirror",
  "icon": "clock",
  "defaultConfig": { "format": "HH:mm:ss", "timezone": "UTC", "showDate": true },
  "configSchema": {
    "type": "object",
    "properties": {
      "format": { "type": "string", "description": "Time format string", "default": "HH:mm:ss" },
      "timezone": { "type": "string", "description": "IANA timezone name", "default": "UTC" },
      "showDate": { "type": "boolean", "description": "Show date below time", "default": true }
    },
    "required": ["format", "timezone", "showDate"]
  },
  "gridConstraints": { "minW": 2, "minH": 2, "maxW": 8, "maxH": 4, "defaultW": 4, "defaultH": 3 }
}
```

### Get Data

Returns current module data for a widget instance.

```
GET /api/modules/:id/data?instanceId=<instanceId>
```

Response `200` (example for clock):
```json
{
  "time": "14:32:05",
  "date": "2026-02-21",
  "timezone": "America/New_York",
  "timestamp": 1771790525000
}
```

The response shape is module-specific.

---

## WebSocket API

**Endpoint**: `/ws` (proxied by Nginx to the WebSocket Bridge on port 8080)
**Protocol**: Socket.IO (supports WebSocket and HTTP long-polling transports)

### Authentication

The Nginx gateway injects the `X-API-Key` header on the WebSocket upgrade request. For direct connections (bypassing Nginx), pass the key in the Socket.IO auth object:

```javascript
import { io } from 'socket.io-client';

const socket = io('/ws', {
  auth: { apiKey: 'your-api-key' },
});
```

Connections without a valid API key are rejected immediately.

### Client Events (browser to server)

#### subscribe

Subscribe to one or more Redis pub/sub channels. Only channels matching `module:<name>:<detail>` are allowed.

```javascript
socket.emit('subscribe', 'module:clock:time');

// Or subscribe to multiple channels at once:
socket.emit('subscribe', ['module:clock:time', 'module:weather:forecast']);
```

#### unsubscribe

Unsubscribe from one or more channels.

```javascript
socket.emit('unsubscribe', 'module:clock:time');
```

#### publish

Publish a message to a Redis channel. Same channel restrictions apply.

```javascript
socket.emit('publish', {
  channel: 'module:sticky_notes:notes',
  payload: {
    instanceId: 'sticky_notes_01',
    data: { text: 'Remember to buy milk' },
    timestamp: Date.now(),
  },
});
```

### Server Events (server to browser)

#### message

Emitted when a subscribed Redis channel receives a new message.

```javascript
socket.on('message', ({ channel, payload }) => {
  // channel: "module:clock:time"
  // payload: { instanceId: "clock_01", data: { time: "14:32:05", ... }, timestamp: ... }
});
```

### Allowed Channels

The WebSocket Bridge enforces the following regex for both subscribe and publish operations:

```
^module:(clock|weather|calendar|rss|system_stats|now_playing|sticky_notes):.+$
```

System channels (`events:system`, `events:ui`, `events:modules:*`) are not accessible from the browser. See [REDIS_CHANNELS.md](REDIS_CHANNELS.md) for the complete channel specification.

---

## Error Responses

All services return errors in this format:

```json
{
  "detail": "Human-readable error message"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (new profile, new theme) |
| 400 | Bad request (invalid input, attempting to delete default profile) |
| 401 | Unauthorized (missing or invalid API key) |
| 404 | Not found (module, profile, or instance config does not exist) |
| 409 | Conflict (profile name already exists) |
| 500 | Internal server error |

---

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md) -- system design and data flow
- [Module Development Guide](MODULE_DEVELOPMENT.md) -- building new modules
- [Redis Channels](REDIS_CHANNELS.md) -- pub/sub channel naming
- [Security Requirements](SECURITY_REQUIREMENTS.md) -- authentication and CORS details
