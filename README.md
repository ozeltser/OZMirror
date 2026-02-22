# OzMirror - Smart Display Platform

A distributed, microservices-based smart display application inspired by MagicMirror2.

## Features

- **6 Bundled Modules**: Clock, Weather, Calendar, RSS, System Stats, Sticky Notes
- **Drag & Drop Layout**: Customize your display with touch or mouse
- **Real-time Updates**: WebSocket-powered live data via Redis pub/sub
- **Themeable UI**: Dark, Light, AMOLED themes + custom themes
- **Layout Profiles**: Save and switch between named layouts (e.g., "Morning", "Night")
- **Per-Module Settings**: Configure each widget instance through auto-generated forms
- **Raspberry Pi Ready**: Optimized for Pi 4 (4GB+)
- **Docker-based**: Each module runs in its own container

## Architecture

```
Browser --> Nginx API Gateway --> React SPA (UI)
                               --> /api/config/* --> Config Service (FastAPI + MySQL)
                               --> /ws --> WebSocket Bridge (Socket.IO + Redis)
                               --> /api/modules/* --> Module Containers (Node.js)

Module Containers --> Redis Pub/Sub --> WebSocket Bridge --> Browser
Module Containers --> Config Service (registration on startup)
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- `make` (pre-installed on Linux/macOS; on Windows use [Git Bash](https://git-scm.com/) or [WSL](https://learn.microsoft.com/en-us/windows/wsl/install))
- (For Pi) Raspberry Pi 4 with 4GB+ RAM

---

### Option A -- Local / Development (recommended for first run)

No SSL certificates required. Uses HTTP with hot-reload.

1. **Clone & configure**
   ```bash
   git clone <your-repo-url>
   cd OZMirror
   cp .env.example .env
   ```
   Open `.env` and set at minimum:
   - `REDIS_PASSWORD`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` -- choose any secure passwords
   - `API_KEY` -- a random 32-char string (e.g. `openssl rand -hex 16`)
   - `ALLOWED_ORIGINS` / `ALLOWED_CORS_ORIGINS` -- add any domain/IP you'll use to access the UI (see note below)
   - Optional: `WEATHER_API_KEY` and Google Calendar keys for those modules

2. **Start in dev mode**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

3. **Open in browser**
   ```
   http://localhost
   ```

---

### Option B -- Production (HTTPS)

Same `.env` steps as above, then provide SSL certificates **before** starting:

```bash
# Option 1: Self-signed cert (local/testing only -- browser will warn)
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
make deploy
```

Access at `https://localhost` (HTTP automatically redirects to HTTPS).

> Cert files are gitignored -- never commit them to the repository.

---

### CORS: accessing from a custom domain or remote machine

If you open OZMirror from any address other than `localhost` (e.g. a domain name or another machine on your network), add that origin to `.env`:

```env
ALLOWED_ORIGINS=http://localhost,http://localhost:80,https://yourdomain.com
ALLOWED_CORS_ORIGINS=http://localhost,http://localhost:80,https://yourdomain.com
```

Also add the same domain to `nginx/nginx.conf` inside the `map $http_origin $allow_origin` block:

```nginx
map $http_origin $allow_origin {
    default                              "";
    ~^http://localhost(:[0-9]+)?$        $http_origin;
    ~^http://127\.0\.0\.1(:[0-9]+)?$    $http_origin;
    ~^https://yourdomain\.com$           $http_origin;
}
```

Then run `make deploy` to rebuild and restart with the new config.

> **Why?** Browsers enforce CORS preflight checks on write requests (`PUT`/`DELETE`). Without the origin in both lists, layout saves will silently fail.

---

## Makefile -- deployment workflow

A `Makefile` is included so you never have to remember Docker flags. Always use `make deploy` (not plain `docker compose up`) after pulling new code -- it rebuilds the images so code changes actually take effect.

| Command | What it does |
|---------|-------------|
| `make deploy` | `git pull` + rebuild all images + restart (**use this every time you update**) |
| `make build` | Rebuild all images without restarting |
| `make restart` | Restart containers without rebuilding (for `.env`-only changes) |
| `make down` | Stop and remove all containers (data volumes are preserved) |
| `make ps` | Show status of all containers |
| `make logs` | Tail logs for all services |
| `make logs-gateway` | Tail Nginx gateway logs |
| `make logs-config` | Tail config-service logs |
| `make logs-ui` | Tail UI container logs |
| `make logs-ws` | Tail WebSocket bridge logs |
| `make help` | Print all available targets |

> **`make` not found?** On Debian/Ubuntu: `sudo apt install make`. On macOS it ships with Xcode Command Line Tools (`xcode-select --install`).

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Module Development Guide](docs/MODULE_DEVELOPMENT.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Redis Channels](docs/REDIS_CHANNELS.md)
- [Security Requirements](docs/SECURITY_REQUIREMENTS.md)
- [Implementation Plans](docs/plans/README.md)

## Project Status

**Current Phase**: v1 Development
**Version**: 0.9.0

See [Implementation Plans](docs/plans/README.md) for detailed roadmap.

## Performance Targets

- Cold start: < 15 seconds
- UI load time: < 2 seconds
- Memory usage: < 1.5GB (5 modules)
- API response (P95): < 100ms

## License

GPL-3.0 License - See LICENSE file

## Credits

Inspired by [MagicMirror2](https://magicmirror.builders/)
