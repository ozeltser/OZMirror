#!/usr/bin/env bash
# generate-ssl.sh — Generate a self-signed TLS certificate for local HTTPS.
# The generated cert is placed in nginx/ssl/ which is gitignored.
# For production, replace with a real certificate (e.g. Let's Encrypt).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../nginx/ssl"
DOMAIN="${DOMAIN:-localhost}"
DAYS="${DAYS:-3650}"

info() { echo "[generate-ssl] $*"; }

mkdir -p "$SSL_DIR"

CERT="$SSL_DIR/cert.pem"
KEY="$SSL_DIR/key.pem"

if [[ -f "$CERT" && -f "$KEY" ]]; then
  info "Certificates already exist at $SSL_DIR."
  info "Delete them and re-run this script to regenerate."
  exit 0
fi

info "Generating self-signed certificate for '$DOMAIN' (valid $DAYS days)…"

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -keyout "$KEY" \
  -out "$CERT" \
  -days "$DAYS" \
  -subj "/C=AU/ST=NSW/L=Sydney/O=OzMirror/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY"
chmod 644 "$CERT"

info "Certificate:  $CERT"
info "Private key:  $KEY"
info ""
info "NOTE: This is a self-signed certificate — browsers will show a security"
info "warning. Accept the exception or use a real certificate for production."
