# Now Playing Module Plan

**Phase**: 6 (Days 21-22)
**Status**: Not Started
**Dependencies**: API-Dependent Modules Plan (Phase 4 complete), Advanced UI Features (Phase 5 complete)

## Overview

The **Now Playing** module is the most complex module, featuring:
- Spotify OAuth 2.0 integration
- MPRIS system integration (Linux media players)
- Album artwork display
- Playback controls

**Why Last**: Tests advanced integration patterns, OAuth flow, system-level APIs.

## Detailed Implementation Steps

*This detailed plan will be expanded when you're ready to start Phase 6.*

Refer to the [Master Coordination Plan](C:\Users\ozlis\.claude\plans\lively-chasing-donut.md) for high-level overview.

---

## Integration Options

### Option 1: Spotify API (OAuth)

**Setup**:
1. Create Spotify Developer App: https://developer.spotify.com/dashboard
2. Get Client ID and Client Secret
3. Configure redirect URI
4. Add to `.env`:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:80/callback
   ```

**Implementation**:
*Details to be added*

### Option 2: MPRIS (Linux Media Players)

**What is MPRIS**:
- Media Player Remote Interfacing Specification
- D-Bus interface for media players on Linux
- Works with VLC, Chromium, Firefox, Spotify, etc.

**Implementation**:
*Details to be added*

---

## Backend Implementation

### OAuth Flow (Spotify)
*Details to be added*

### MPRIS Integration
*Details to be added*

### REST API
*Details to be added*

---

## Frontend Implementation

### Widget Design
- Large album art (square)
- Track title (prominent)
- Artist and album names
- Progress bar
- Playback controls (optional)

### Component Structure
*Details to be added*

---

## Testing Strategy

### Spotify Testing
- [ ] OAuth flow completes successfully
- [ ] Refresh token stored securely
- [ ] Currently playing track fetched
- [ ] Album art loads
- [ ] Playback controls work

### MPRIS Testing (on Raspberry Pi)
- [ ] Detects media players via D-Bus
- [ ] Reads current track info
- [ ] Updates on track change
- [ ] Playback controls send commands

---

## Verification Checklist

- [ ] Backend implements Spotify OR MPRIS integration
- [ ] OAuth flow works (if Spotify)
- [ ] Currently playing track displayed
- [ ] Album artwork shown
- [ ] Artist and track names correct
- [ ] Progress bar updates
- [ ] Play/pause button works (if enabled)
- [ ] Next/previous buttons work (if enabled)
- [ ] Updates when track changes
- [ ] Handles no media playing state

---

**Previous Plan**: [API-Dependent Modules Plan](05-api-modules.md)
**Next Plan**: [Deployment & Testing Plan](07-deployment-testing.md)
