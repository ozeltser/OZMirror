# Clock Module Plan

**Phase**: 2 (Days 8-9)
**Status**: Not Started
**Dependencies**: Infrastructure Setup Plan (Phase 1 complete)

## Overview

The Clock module is the **first module** to implement. It proves the entire architecture works end-to-end:
- Backend REST API
- Redis pub/sub messaging
- Module self-registration
- Frontend widget rendering
- Real-time WebSocket updates

**Why Clock First**: Simple, no external dependencies, validates all architectural patterns.

## Detailed Implementation Steps

*This detailed plan will be expanded when you're ready to start Phase 2.*

---

## Backend Implementation (Node.js + Express)

### Project Structure
```
modules/clock/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts          # Express app
│   ├── routes.ts          # REST endpoints
│   ├── redis-client.ts    # Redis pub/sub
│   ├── config-client.ts   # Fetch config from Config Service
│   └── time-formatter.ts  # Time/date formatting logic
├── data/                  # Persistent state (volume mount)
└── tests/
    └── clock.test.ts
```

### REST API Endpoints
*Details to be added*

### Module Lifecycle
*Details to be added*

### Redis Pub/Sub
*Details to be added*

---

## Frontend Implementation (React + TypeScript)

### Widget Component
```
ui/src/widgets/
├── ClockWidget.tsx
└── ClockWidget.module.css
```

### Data Flow
*Details to be added*

### Styling
*Details to be added*

---

## Testing Strategy

### Backend Tests
- [ ] Time formatting functions
- [ ] REST API endpoints
- [ ] Module registration
- [ ] Redis message publishing

### Frontend Tests
- [ ] Component rendering
- [ ] Real-time updates via WebSocket
- [ ] Edit mode overlay

### Integration Tests
- [ ] End-to-end: Backend → Redis → WebSocket → UI
- [ ] Layout persistence

---

## Verification Checklist

- [ ] Clock module container builds successfully
- [ ] `GET /health` returns healthy status
- [ ] `GET /manifest` returns module metadata
- [ ] `GET /data?instanceId=clock_01` returns current time
- [ ] Module registers with Config Service on startup
- [ ] Redis messages published every second
- [ ] Clock widget displays in UI
- [ ] Time updates in real-time
- [ ] Can drag/resize clock in edit mode
- [ ] Layout persists after refresh

---

**Previous Plan**: [UI Container Development Plan](02-ui-container.md)
**Next Plan**: [Simple Modules Plan](04-simple-modules.md)
