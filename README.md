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

### Installation

1. **Clone & Configure**:
   ```bash
   git clone <your-repo-url>
   cd OZMirror
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```

3. **Open in Browser**:
   ```
   http://localhost:80
   ```

### Development Mode

```bash
# Start with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

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
