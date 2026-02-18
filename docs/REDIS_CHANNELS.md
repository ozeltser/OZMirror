# Redis Channel Naming

OZMirror uses Redis pub/sub for real-time communication between backend
services and the browser (via the WebSocket Bridge).

## Naming Convention

```
<scope>:<module_or_subsystem>:<detail>
```

All channel names are lowercase with colons as separators.

## System Channels (backend-only)

These channels carry internal control-plane traffic and are **not**
accessible to browser clients through the WebSocket Bridge.

| Channel | Purpose | Example payloads |
|---|---|---|
| `events:system` | System-wide events | `EDIT_MODE_CHANGED`, `THEME_CHANGED`, `LAYOUT_PROFILE_CHANGED`, `CONFIG_UPDATED` |
| `events:ui` | UI interactions | `MODULE_CLICKED`, `LAYOUT_CHANGED`, `SETTINGS_OPENED` |
| `events:modules:<name>` | Module lifecycle events | Heartbeat, error status |

### Payload shape

```jsonc
{
  "action": "EDIT_MODE_CHANGED",
  "enabled": true,
  "timestamp": 1708012345000
}
```

## Module Data Channels (WebSocket-accessible)

Browser clients may subscribe to **and** publish on these channels.
The WebSocket Bridge enforces the whitelist at connect time.

| Pattern | Examples |
|---|---|
| `module:clock:<detail>` | `module:clock:time`, `module:clock:config` |
| `module:weather:<detail>` | `module:weather:forecast` |
| `module:calendar:<detail>` | `module:calendar:events` |
| `module:rss:<detail>` | `module:rss:feed` |
| `module:system_stats:<detail>` | `module:system_stats:cpu` |
| `module:now_playing:<detail>` | `module:now_playing:track` |
| `module:sticky_notes:<detail>` | `module:sticky_notes:notes` |

### Regex (enforced in `services/websocket/src/server.ts`)

```
^module:(clock|weather|calendar|rss|system_stats|now_playing|sticky_notes):.+$
```

### Payload shape

Payloads are JSON objects. Non-JSON strings are forwarded but logged as
warnings by the Redis Bridge.

```jsonc
{
  "instanceId": "clock_01",
  "data": { /* module-specific */ },
  "timestamp": 1708012345000
}
```

## Security Model

| Channel scope | Subscribe | Publish | Accessible via WebSocket? |
|---|---|---|---|
| `events:*` | Backend services only | Backend services only | No |
| `module:<name>:*` | Any authenticated client | Any authenticated client | Yes |

The WebSocket Bridge requires a valid `API_KEY` on every connection.
Unauthenticated sockets are rejected; there is no anonymous access.

## Adding a New Module Channel

1. Add the module name to the `ALLOWED_MODULE_CHANNELS` regex in
   `services/websocket/src/server.ts`.
2. Update this document.
3. Rebuild the `websocket-bridge` container.
