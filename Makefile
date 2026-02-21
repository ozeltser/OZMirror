.PHONY: deploy restart down logs logs-gateway logs-config logs-ui ps build help

# ── Deploy ────────────────────────────────────────────────────────────────────
# Pull latest code and rebuild + restart all containers.
# Always use this after a git pull to guarantee fresh images.
deploy:
	git pull
	docker compose up -d --build

# ── Build only ────────────────────────────────────────────────────────────────
# Rebuild all images without starting containers.
build:
	docker compose build

# ── Restart (no rebuild) ─────────────────────────────────────────────────────
# Restart all containers using existing images (no code changes).
restart:
	docker compose up -d --force-recreate

# ── Stop ──────────────────────────────────────────────────────────────────────
# Stop and remove all containers (volumes are preserved).
down:
	docker compose down

# ── Status ────────────────────────────────────────────────────────────────────
ps:
	docker compose ps

# ── Logs ──────────────────────────────────────────────────────────────────────
# Tail logs for all services.
logs:
	docker compose logs -f --tail=50

# Tail logs for specific services (useful for debugging).
logs-gateway:
	docker compose logs -f --tail=50 gateway

logs-config:
	docker compose logs -f --tail=50 config-service

logs-ui:
	docker compose logs -f --tail=50 ui

logs-ws:
	docker compose logs -f --tail=50 websocket-bridge

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "OZMirror make targets:"
	@echo ""
	@echo "  make deploy       git pull + rebuild all images + restart (use after every git pull)"
	@echo "  make build        rebuild all images without restarting"
	@echo "  make restart      restart containers without rebuilding"
	@echo "  make down         stop and remove all containers"
	@echo "  make ps           show container status"
	@echo "  make logs         tail all logs"
	@echo "  make logs-gateway tail gateway logs"
	@echo "  make logs-config  tail config-service logs"
	@echo "  make logs-ui      tail ui logs"
	@echo "  make logs-ws      tail websocket-bridge logs"
	@echo ""
