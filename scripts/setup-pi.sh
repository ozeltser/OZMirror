#!/usr/bin/env bash
# setup-pi.sh — Bootstrap OzMirror on a fresh Raspberry Pi OS installation.
# Run as a regular user with sudo privileges.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ozeltser/OZMirror.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/OZMirror}"

info()  { echo "[setup-pi] $*"; }
error() { echo "[setup-pi] ERROR: $*" >&2; exit 1; }

# ── 1. System packages ──────────────────────────────────────────────────────

info "Updating package lists…"
sudo apt-get update -q

info "Installing required packages…"
sudo apt-get install -y -q \
  git \
  curl \
  ca-certificates \
  gnupg \
  lsb-release

# ── 2. Docker ───────────────────────────────────────────────────────────────

if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  info "Installing Docker…"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  info "Docker installed. NOTE: Log out and back in for group membership to take effect."
fi

# ── 3. Clone repository ─────────────────────────────────────────────────────

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repository already exists at $INSTALL_DIR — pulling latest…"
  git -C "$INSTALL_DIR" pull
else
  info "Cloning OzMirror to $INSTALL_DIR…"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── 4. Create .env file ─────────────────────────────────────────────────────

if [[ -f .env ]]; then
  info ".env already exists — skipping creation."
else
  info "Creating .env from .env.example…"
  cp .env.example .env

  # Generate random secrets
  API_KEY=$(openssl rand -hex 16)
  MYSQL_PASSWORD=$(openssl rand -hex 16)
  MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
  REDIS_PASSWORD=$(openssl rand -hex 16)

  sed -i "s/^API_KEY=.*/API_KEY=$API_KEY/" .env
  sed -i "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=$MYSQL_PASSWORD/" .env
  sed -i "s/^MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD/" .env
  sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" .env

  info ".env created with generated secrets."
  info "Edit $INSTALL_DIR/.env to set WEATHER_API_KEY, DOMAIN, and other options."
fi

# ── 5. Generate SSL certificates ────────────────────────────────────────────

if [[ -f nginx/ssl/cert.pem ]]; then
  info "SSL certificates already exist — skipping."
else
  info "Generating self-signed SSL certificates…"
  bash scripts/generate-ssl.sh
fi

# ── Done ────────────────────────────────────────────────────────────────────

info "Setup complete!"
info "Next steps:"
info "  1. Edit $INSTALL_DIR/.env (set WEATHER_API_KEY, review DOMAIN)"
info "  2. Run: cd $INSTALL_DIR && make deploy"
info "  3. Run: bash scripts/start-kiosk.sh  (to launch Chromium kiosk)"
