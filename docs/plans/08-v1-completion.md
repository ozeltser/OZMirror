# V1 Completion Plan — Closing the Gaps

**Status**: Ready for Implementation
**Last Updated**: 2026-02-21

This plan identifies what remains to bring OZMirror from its current state to a complete v1 per the PRODUCT_SPEC.md. The work is organized into 6 phases, ordered by priority and dependency.

---

## Current State Summary

**Done**:
- All 6 module backends (clock, weather, calendar, rss, system_stats, sticky_notes)
- All 6 frontend widgets with REST polling + WebSocket real-time updates
- Config Service (FastAPI + MySQL) with full layout/module/settings/theme REST API
- WebSocket Bridge (Socket.IO + ioredis) with channel whitelisting
- Nginx API Gateway with HTTPS, CORS, dynamic module routing, API key injection
- React SPA with react-grid-layout Canvas, ModulePicker, SettingsPanel, EditToolbar
- Zustand store, keyboard shortcuts (E, Esc, F, Ctrl+S, Ctrl+,)
- Docker Compose orchestration for all 12 services with health checks
- Makefile for deploy/build/restart/logs

---

## Phase 1: Per-Module Settings UI

**Why first**: This is the most user-visible missing feature. Users currently cannot configure individual module instances (e.g., change a clock's timezone, set a weather city, configure RSS feed URL).

### Tasks

1. **Add a `ModuleSettingsModal` component** (`ui/src/components/ModuleSettingsModal/`)
   - Opens when clicking a "gear" icon on a module in edit mode
   - Fetches the module's `configSchema` from the registry (already available via `GET /api/config/modules/:id`)
   - Auto-generates a form from JSON Schema fields: text inputs, selects, checkboxes, number inputs
   - Falls back to a JSON editor textarea if no schema is available
   - Saves via `PUT /api/config/modules/:id/config/:instanceId`

2. **Update `ModuleWidget` edit overlay**
   - Add a gear/settings button alongside the existing remove button
   - Wire click to open `ModuleSettingsModal` with the module's `instanceId` and `moduleId`

3. **Update `useConfig` hook or add `useModuleConfig` hook**
   - Fetch and cache per-instance config
   - Expose a save function that PUTs to the config service

4. **Add `configSchema` to each module's manifest** (some may already have it)
   - clock: format, timezone, showDate, showSeconds
   - weather: city, units, showFeelsLike, showHumidity, showWind
   - calendar: icalUrl, daysToShow
   - rss: feedUrl, itemCount, scrollSpeed
   - system_stats: updateInterval, showCpu, showMemory, showDisk
   - sticky_notes: fontSize, color

### Files to create/modify
- `ui/src/components/ModuleSettingsModal/ModuleSettingsModal.tsx` (new)
- `ui/src/components/ModuleSettingsModal/ModuleSettingsModal.module.css` (new)
- `ui/src/components/ModuleWidget/ModuleWidget.tsx` (add gear button)
- `ui/src/components/ModuleWidget/ModuleWidget.module.css` (style gear button)
- Module manifests: `modules/*/src/manifest.ts` (add `configSchema`)

---

## Phase 2: Testing

**Why second**: No test files exist anywhere in the project. Tests are essential before making further changes and for deployment confidence.

### Tasks

1. **Config Service tests** (pytest)
   - Add `services/config/tests/` with `conftest.py`, `test_layout.py`, `test_modules.py`, `test_settings.py`
   - Use SQLite in-memory for test DB
   - Test all CRUD operations, validation, edge cases (delete default profile, duplicate profile)
   - Test API key authentication (reject missing/wrong key on PUT/DELETE)

2. **UI component tests** (Vitest + React Testing Library)
   - Add Vitest config to `ui/`
   - Test `Canvas`, `ModuleWidget`, `ModulePicker`, `SettingsPanel`
   - Test `useLayout`, `useModuleData` hooks
   - Test `WebSocketClient` subscribe/unsubscribe
   - Test `InputHandler` key mapping

3. **Module backend tests** (Jest or Vitest)
   - Add tests for at least the clock module as a template
   - Test `/health`, `/manifest`, `/data` endpoints
   - Test Redis publishing logic
   - Test Config Service registration retry logic

4. **CI configuration** (optional but recommended)
   - Add a GitHub Actions workflow that runs tests on PR

### Files to create
- `services/config/tests/conftest.py`
- `services/config/tests/test_layout.py`
- `services/config/tests/test_modules.py`
- `services/config/tests/test_settings.py`
- `ui/vitest.config.ts`
- `ui/src/**/*.test.tsx` (component tests)
- `modules/clock/src/__tests__/routes.test.ts`

---

## Phase 3: Touch/Gesture Support & Cursor Auto-Hide

**Why third**: The spec targets touch-first kiosk deployment. Currently only keyboard input is handled.

### Tasks

1. **Add `@use-gesture/react`** to `ui/package.json`

2. **Implement touch gestures in `InputHandler` or a new `GestureHandler`**
   - Tap: click/activate
   - Long press (500ms): open module context menu in edit mode
   - Swipe left/right: forward to focused module
   - Two-finger swipe down: open SettingsPanel

3. **Cursor auto-hide in kiosk mode**
   - When `settings.kiosk` is true, add a CSS class to `document.body` after `cursorTimeout` ms of inactivity
   - Remove class on `mousemove`
   - CSS: `body.cursor-hidden { cursor: none; }`

### Files to modify
- `ui/package.json` (add @use-gesture/react)
- `ui/src/core/InputHandler.ts` or new `ui/src/core/GestureHandler.ts`
- `ui/src/App.tsx` (init gesture handler, cursor auto-hide logic)
- `ui/src/index.css` (cursor-hidden class)

---

## Phase 4: Responsive Grid & Layout Polish

### Tasks

1. **Switch `GridLayout` to `ResponsiveGridLayout`**
   - Support breakpoints: lg (1200), md (996), sm (768) per spec
   - Store per-breakpoint layouts

2. **Implement Ctrl+Z undo** for layout changes
   - Maintain a layout history stack in Zustand (max ~20 entries)
   - Pop on Ctrl+Z and persist

3. **Remove stale `now_playing` icon** from `ModulePicker` icon map

### Files to modify
- `ui/src/components/Canvas/Canvas.tsx` (ResponsiveGridLayout)
- `ui/src/store/appStore.ts` (undo stack)
- `ui/src/App.tsx` (wire Ctrl+Z)
- `ui/src/components/ModulePicker/ModulePicker.tsx` (remove now_playing)

---

## Phase 5: Deployment Scripts & Docker Hardening

### Tasks

1. **Create `scripts/` directory** with:
   - `setup-pi.sh` — Install Docker, Docker Compose, clone repo, create .env
   - `start-kiosk.sh` — Launch Chromium in kiosk mode with screen blanking disabled
   - `backup-config.sh` — Dump MySQL + module data volumes to timestamped tarball
   - `generate-ssl.sh` — Generate self-signed certs for local HTTPS

2. **Add Docker resource limits** to `docker-compose.yml`
   - Per the spec: UI 128MB/0.5c, Gateway 64MB/0.5c, Config 256MB/1.0c, Redis 128MB/0.5c, WS Bridge 128MB/0.5c, Modules 64-128MB/0.25c

3. **Add `POST /api/config/validate`** endpoint to Config Service
   - Accepts a config object + schema reference
   - Returns validation result

4. **Run containers as non-root** where not already done

### Files to create
- `scripts/setup-pi.sh`
- `scripts/start-kiosk.sh`
- `scripts/backup-config.sh`
- `scripts/generate-ssl.sh`

### Files to modify
- `docker-compose.yml` (add `deploy.resources.limits`)
- `services/config/app/routes/` (add validate endpoint)

---

## Phase 6: Documentation & Cleanup

### Tasks

1. **Update plan README statuses** — Mark completed phases as done

2. **Create missing docs**:
   - `docs/ARCHITECTURE.md` — System architecture overview
   - `docs/MODULE_DEVELOPMENT.md` — Guide for building new modules
   - `docs/API.md` — REST API reference (can be auto-generated from FastAPI `/docs`)

3. **Update README.md** with current feature list, screenshots, setup instructions

4. **Clean up minor issues**:
   - Remove `tmpclaude-*` files from repo root
   - Verify `.env.example` is complete and documented

---

## Priority Summary

| Phase | Scope | Impact |
|-------|-------|--------|
| 1 | Per-Module Settings UI | High — core UX gap |
| 2 | Testing | High — zero coverage currently |
| 3 | Touch/Gesture + Cursor | Medium — required for kiosk deployment |
| 4 | Responsive Grid + Undo | Medium — polish for different screen sizes |
| 5 | Deploy Scripts + Docker | Medium — required for Pi production use |
| 6 | Docs & Cleanup | Low — polish |

---

**Reference**: [PRODUCT_SPEC.md](../../PRODUCT_SPEC.md)
