# OzMirror - Smart Display Platform

A distributed, microservices-based smart display application inspired by MagicMirror2.

## Features

- 🕐 **7 Bundled Modules**: Clock, Weather, Calendar, RSS, System Stats, Now Playing, Sticky Notes
- 🎨 **Drag & Drop Layout**: Customize your display with touch or mouse
- ⚡ **Real-time Updates**: WebSocket-powered live data
- 🎭 **Themeable UI**: Dark, Light, AMOLED themes + custom themes
- 🥧 **Raspberry Pi Ready**: Optimized for Pi 4 (4GB+)
- 🐳 **Docker-based**: Each module runs in its own container

## Architecture

```
Browser → Nginx → React UI
                ↓
         Config Service
                ↓
         Redis Pub/Sub ← → Module Containers
                ↓
         WebSocket Bridge
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (For Pi) Raspberry Pi 4 with 4GB+ RAM

---

### Option A — Local / Development (recommended for first run)

No SSL certificates required. Uses HTTP with hot-reload.

1. **Clone & configure**
   ```bash
   git clone <your-repo-url>
   cd OZMirror
   cp .env.example .env
   ```
   Open `.env` and set at minimum:
   - `REDIS_PASSWORD`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` — choose any secure passwords
   - `API_KEY` — a random 32-char string (e.g. `openssl rand -hex 16`)
   - Optional: `WEATHER_API_KEY`, Spotify, and Google Calendar keys for those modules

2. **Start in dev mode**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

3. **Open in browser**
   ```
   http://localhost
   ```

---

### Option B — Production (HTTPS)

Same `.env` steps as above, then provide SSL certificates **before** starting:

```bash
# Option 1: Self-signed cert (local/testing only — browser will warn)
openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"

# Option 2: Copy an existing cert/key pair (e.g. from Let's Encrypt)
cp /path/to/fullchain.pem nginx/ssl/cert.pem
cp /path/to/privkey.pem   nginx/ssl/key.pem
```

Then start:
```bash
docker-compose up -d
```

Access at `https://localhost` (HTTP automatically redirects to HTTPS).

> Cert files are gitignored — never commit them to the repository.

## Documentation

- [📐 Architecture](docs/ARCHITECTURE.md)
- [🔧 Module Development Guide](docs/MODULE_DEVELOPMENT.md)
- [📡 API Reference](docs/API.md)
- [🚀 Deployment Guide](docs/DEPLOYMENT.md)
- [📋 Implementation Plans](docs/plans/README.md)

## Project Status

**Current Phase**: Phase 0 - Bootstrap
**Version**: 0.1.0-dev

See [Implementation Plans](docs/plans/README.md) for detailed roadmap.

## Performance Targets

- Cold start: < 15 seconds
- UI load time: < 2 seconds
- Memory usage: < 1.5GB (5 modules)
- API response (P95): < 100ms

## License

GPL-3.0 License - See LICENSE file

## Credits

Inspired by [MagicMirror²](https://magicmirror.builders/)
