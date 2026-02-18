# Simple Modules Plan

**Phase**: 3 (Days 13-14)
**Status**: Complete ✅
**Dependencies**: Clock Module Plan (Phase 2 complete)

## Overview

This plan covers modules without external API dependencies:
- **Sticky Notes** (Day 13) - Editable text notes with SQLite persistence
- **System Stats** (Day 14) - CPU/RAM/disk monitoring

These modules build on the Clock module pattern but add:
- SQLite database integration
- System resource monitoring
- More complex user interactions

## Detailed Implementation Steps

*This detailed plan will be expanded when you're ready to start Phase 3.*

---

## Day 13: Sticky Notes Module ✅

### Backend (Node.js + TypeScript)

**Location**: `modules/sticky_notes/`

**Structure**:
```
modules/sticky_notes/
├── Dockerfile          # Multi-stage build (Node 18 alpine + python/make/g++ for better-sqlite3)
├── package.json        # express, better-sqlite3, redis
├── tsconfig.json
└── src/
    ├── server.ts       # Express app on port 3003, graceful shutdown
    ├── routes.ts       # REST CRUD endpoints + /health + /manifest
    ├── database.ts     # SQLite via better-sqlite3, WAL mode
    └── redis-client.ts # Publishes created/updated/deleted events
```

### Database Schema (Implemented)
```sql
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  content TEXT DEFAULT '',
  color TEXT DEFAULT '#ffeb3b',
  font_size INTEGER DEFAULT 16,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notes_instance_id ON notes(instance_id);
```

### REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/manifest` | Module metadata |
| GET | `/notes?instanceId=X` | List notes for instance |
| GET | `/notes/:id` | Get single note |
| POST | `/notes` | Create note |
| PUT | `/notes/:id` | Update note (content/color/font_size) |
| DELETE | `/notes/:id` | Delete note |

### Redis Channels Published
- `module:sticky_notes:created` — note created
- `module:sticky_notes:updated` — note updated
- `module:sticky_notes:deleted` — note deleted

### Frontend Widget
**Location**: `ui/src/widgets/StickyNotesWidget.tsx`
- Color palette picker (8 colors)
- Font size +/- controls
- Inline text editing (click to edit, blur/Escape to save)
- Real-time updates via WebSocket channels
- Per-instance independent state

---

## Day 14: System Stats Module ✅

### Backend (Node.js + TypeScript)

**Location**: `modules/system_stats/`

**Structure**:
```
modules/system_stats/
├── Dockerfile          # Multi-stage build (Node 18 alpine)
├── package.json        # express, redis (no native deps needed)
├── tsconfig.json
└── src/
    ├── server.ts          # Express app on port 3002, publishes every 5s
    ├── routes.ts          # GET /health, /manifest, /data
    ├── stats-collector.ts # CPU/RAM/disk collection using Node.js os module
    └── redis-client.ts    # Publishes to module:system_stats:update
```

### Metrics Collection (Implemented)
- **CPU usage (%)** — measured by diffing os.cpus() samples between intervals
- **RAM usage** — `os.totalmem()` and `os.freemem()`
- **Disk usage** — `fs.statfsSync('/')` for cross-platform Linux/Pi support
- **Uptime** — `os.uptime()`
- **Platform** — `os.platform()`
- Configurable refresh rate via `STATS_INTERVAL_MS` env var (default 5000ms)

### Redis Channel Published
- `module:system_stats:update` — full stats payload every 5 seconds

### Frontend Widget
**Location**: `ui/src/widgets/SystemStatsWidget.tsx`
- Progress bars for CPU, RAM, Disk
- Color-coded: green (<70%), yellow (70-90%), red (>90%)
- Real-time updates via WebSocket
- Shows uptime

---

## Reusable Patterns

### Module Template
Each module follows this pattern:
1. **Express server** on a dedicated port (3001 clock, 3002 system_stats, 3003 sticky_notes)
2. **`/health`** endpoint for Docker healthchecks
3. **`/manifest`** endpoint returns module metadata and default config
4. **Redis client** connects on startup, publishes events to `module:<name>:<event>` channels
5. **Graceful shutdown** handles SIGTERM/SIGINT
6. **Multi-stage Dockerfile** separates build and runtime layers

### Best Practices
- Use WAL mode for SQLite to allow concurrent reads
- Measure CPU by diffing samples (single-shot reads are inaccurate)
- Publish to Redis channels that match the WebSocket bridge whitelist regex:
  `^module:(clock|weather|calendar|rss|system_stats|now_playing|sticky_notes):.+$`
- Modules do NOT need to authenticate with Config Service for basic operation

---

## Verification Checklist

**Sticky Notes**:
- [x] Backend REST API working
- [x] SQLite database created
- [x] Can create new note
- [x] Can edit note content
- [x] Can change note color
- [x] Can delete note
- [x] Notes persist after refresh (SQLite volume mount)
- [x] Multiple instances work independently

**System Stats**:
- [x] Backend collects metrics
- [x] Metrics published to Redis
- [x] Frontend displays CPU/RAM/disk
- [x] Updates every 5 seconds
- [x] Works on Raspberry Pi (uses Node.js os module + fs.statfsSync)
- [x] No performance impact

---

**Previous Plan**: [Clock Module Plan](03-clock-module.md)
**Next Plan**: [API-Dependent Modules Plan](05-api-modules.md)
