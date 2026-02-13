# Simple Modules Plan

**Phase**: 3 (Days 13-14)
**Status**: Not Started
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

## Day 13: Sticky Notes Module

### Backend (Node.js/Python)
*Details to be added*

### Database Schema
```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  content TEXT,
  color TEXT DEFAULT '#ffeb3b',
  font_size INTEGER DEFAULT 16,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### REST API
*Details to be added*

### Frontend Widget
*Details to be added*

---

## Day 14: System Stats Module

### Backend (Node.js/Python)
*Details to be added*

### Metrics Collection
- CPU usage (%)
- RAM usage (used/total)
- Disk usage (used/total)
- Network I/O (optional)

### Frontend Widget
*Details to be added*

---

## Reusable Patterns

### Module Template
*After implementing these 2 modules, document the common patterns for future modules*

### Best Practices
*Details to be added*

---

## Verification Checklist

**Sticky Notes**:
- [ ] Backend REST API working
- [ ] SQLite database created
- [ ] Can create new note
- [ ] Can edit note content
- [ ] Can change note color
- [ ] Can delete note
- [ ] Notes persist after refresh
- [ ] Multiple instances work independently

**System Stats**:
- [ ] Backend collects metrics
- [ ] Metrics published to Redis
- [ ] Frontend displays CPU/RAM/disk
- [ ] Updates every 5 seconds
- [ ] Works on Raspberry Pi
- [ ] No performance impact

---

**Previous Plan**: [Clock Module Plan](03-clock-module.md)
**Next Plan**: [API-Dependent Modules Plan](05-api-modules.md)
