# API-Dependent Modules Plan

**Phase**: 4 (Days 15-17)
**Status**: Not Started
**Dependencies**: Simple Modules Plan (Phase 3 complete)

## Overview

This plan covers modules requiring external APIs:
- **Weather** (Day 15) - OpenWeatherMap API integration
- **RSS Feed** (Day 16) - RSS/Atom feed parsing
- **Calendar** (Day 17) - Google Calendar/iCal integration

These modules introduce:
- External API integration patterns
- Caching strategies
- API key management
- Error handling for API failures

## Detailed Implementation Steps

*This detailed plan will be expanded when you're ready to start Phase 4.*

Refer to the [Master Coordination Plan](C:\Users\ozlis\.claude\plans\lively-chasing-donut.md) for high-level overview.

---

## Day 15: Weather Module

### API Setup
- Sign up: https://openweathermap.org/api
- Get API key (free tier: 1000 calls/day)
- Add to `.env`: `WEATHER_API_KEY=your_key`

### Backend (Python + FastAPI)
*Details to be added*

### Caching Strategy
- Cache weather data in Redis
- TTL: 10 minutes
- Reduce API calls, improve response time

### Frontend Widget
*Details to be added*

---

## Day 16: RSS Feed Module

### Feed Parsing
- Node.js: `rss-parser` package
- Python: `feedparser` library
- Support both RSS and Atom formats

### Backend
*Details to be added*

### Frontend Widget
*Details to be added*

---

## Day 17: Calendar Module

### Integration Options

**Option 1: iCal URL (Simpler - MVP)**
- Parse .ics files
- No OAuth required
- Works with Google Calendar public URLs

**Option 2: Google Calendar API (Advanced)**
- OAuth 2.0 flow
- Access private calendars
- More features but complex setup

### Backend
*Details to be added*

### Frontend Widget
*Details to be added*

---

## Common Patterns

### API Error Handling
*Details to be added*

### Caching Pattern
*Details to be added*

### Configuration Management
*Details to be added*

---

## Verification Checklist

**Weather Module**:
- [ ] API key configured in .env
- [ ] Backend fetches weather data
- [ ] Data cached in Redis
- [ ] Frontend displays current weather
- [ ] 3-day forecast shown
- [ ] Updates every 10 minutes
- [ ] Handles API failures gracefully

**RSS Feed Module**:
- [ ] Can parse RSS feeds
- [ ] Can parse Atom feeds
- [ ] Headlines stored in SQLite
- [ ] Frontend scrolls headlines
- [ ] Clicking headline opens article
- [ ] Updates every 30 minutes
- [ ] Handles malformed feeds

**Calendar Module**:
- [ ] iCal parsing works OR Google OAuth flow complete
- [ ] Events stored in SQLite
- [ ] Frontend shows upcoming events
- [ ] Handles recurring events
- [ ] Timezone support working
- [ ] Updates on schedule

---

**Previous Plan**: [Simple Modules Plan](04-simple-modules.md)
**Next Plan**: [Now Playing Module Plan](06-now-playing.md)
