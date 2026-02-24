#!/usr/bin/env bash
# backup-config.sh — Create a timestamped backup of OzMirror configuration data.
# Backs up: MySQL database dump + sticky-notes SQLite volume + .env file.
# Usage: bash scripts/backup-config.sh [output-dir]
set -euo pipefail

BACKUP_DIR="${1:-$HOME/ozmirror-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="ozmirror_backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

info()  { echo "[backup] $*"; }
error() { echo "[backup] ERROR: $*" >&2; exit 1; }

# ── Load environment ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  error ".env not found at $ENV_FILE"
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

MYSQL_USER="${MYSQL_USER:-ozmirror}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:?MYSQL_PASSWORD not set in .env}"
MYSQL_DATABASE="${MYSQL_DATABASE:-ozmirror}"

# ── Create output directory ──────────────────────────────────────────────────

mkdir -p "$BACKUP_PATH"
info "Backing up to $BACKUP_PATH"

# ── MySQL dump ───────────────────────────────────────────────────────────────

info "Dumping MySQL database '$MYSQL_DATABASE'…"
docker exec ozmirror-mysql \
  mysqldump \
    -u"$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    "$MYSQL_DATABASE" \
  > "$BACKUP_PATH/mysql_$MYSQL_DATABASE.sql"
info "MySQL dump: $BACKUP_PATH/mysql_$MYSQL_DATABASE.sql"

# ── Sticky Notes SQLite backup ───────────────────────────────────────────────

if docker inspect ozmirror-sticky-notes &>/dev/null; then
  info "Backing up Sticky Notes SQLite database…"
  docker exec ozmirror-sticky-notes \
    sh -c 'sqlite3 /app/data/sticky-notes.db ".dump"' \
    > "$BACKUP_PATH/sticky_notes.sql" 2>/dev/null || true
  info "Sticky Notes dump: $BACKUP_PATH/sticky_notes.sql"
fi

# ── .env backup ──────────────────────────────────────────────────────────────

cp "$ENV_FILE" "$BACKUP_PATH/.env.bak"
info ".env backed up."

# ── Create tarball ───────────────────────────────────────────────────────────

TARBALL="$BACKUP_DIR/$BACKUP_NAME.tar.gz"
tar -czf "$TARBALL" -C "$BACKUP_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"

info "Backup complete: $TARBALL"
info "Size: $(du -sh "$TARBALL" | cut -f1)"
