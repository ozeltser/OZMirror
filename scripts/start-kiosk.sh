#!/usr/bin/env bash
# start-kiosk.sh — Launch OzMirror in Chromium kiosk mode.
# Intended for autostart on Raspberry Pi (e.g. via /etc/xdg/lxsession/LXDE-pi/autostart).
set -euo pipefail

OZMIRROR_URL="${OZMIRROR_URL:-https://localhost}"

info() { echo "[start-kiosk] $*"; }

# ── Disable screen blanking and power management ────────────────────────────

xset s off         # disable screen saver
xset s noblank     # do not blank the screen
xset -dpms         # disable DPMS (Energy Star) features

# ── Hide mouse cursor when idle (xdotool alternative handled in the app) ────

# Optionally install and run unclutter if the app-level cursor-hide is not enough:
# sudo apt-get install -y unclutter && unclutter -idle 3 -root &

# ── Wait for the stack to be ready ──────────────────────────────────────────

info "Waiting for OzMirror to be ready at $OZMIRROR_URL…"
for i in $(seq 1 30); do
  if curl -sk "$OZMIRROR_URL/health" | grep -q "healthy"; then
    info "Stack is up."
    break
  fi
  if [[ $i -eq 30 ]]; then
    info "WARNING: Stack did not become healthy after 30 seconds. Launching anyway."
  fi
  sleep 1
done

# ── Launch Chromium in kiosk mode ───────────────────────────────────────────

info "Launching Chromium at $OZMIRROR_URL"

chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --check-for-update-interval=31536000 \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-features=TranslateUI \
  --disable-pinch \
  "$OZMIRROR_URL"
