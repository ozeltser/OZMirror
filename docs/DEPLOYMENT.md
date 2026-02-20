# Deployment Guide

For setup instructions see the [Quick Start](../README.md#quick-start) section in the README.

## Summary

| Mode | Command | Access | Certs required? |
|------|---------|--------|-----------------|
| Development | `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d` | `http://localhost` | No |
| Production | `docker-compose up -d` | `https://localhost` | Yes — place in `nginx/ssl/` |

## SSL Certificates (Production)

Place the following files in `nginx/ssl/` before starting production:

| File | Description |
|------|-------------|
| `nginx/ssl/cert.pem` | Full-chain certificate (PEM format) |
| `nginx/ssl/key.pem` | Private key (PEM format) |

These files are gitignored — never commit them.

**Self-signed (testing only):**
```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

**Let's Encrypt / existing cert:**
```bash
cp /path/to/fullchain.pem nginx/ssl/cert.pem
cp /path/to/privkey.pem   nginx/ssl/key.pem
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | Random 32-char key — `openssl rand -hex 16` |
| `REDIS_PASSWORD` | Yes | Redis auth password |
| `MYSQL_PASSWORD` | Yes | MySQL user password |
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root password |
| `WEATHER_API_KEY` | Optional | OpenWeatherMap key |
| `SPOTIFY_CLIENT_ID` | Optional | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Optional | Spotify app client secret |
| `GOOGLE_CALENDAR_CLIENT_ID` | Optional | Google Calendar OAuth client ID |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Optional | Google Calendar OAuth client secret |
| `TZ` | Optional | Timezone (default: `America/New_York`) |
