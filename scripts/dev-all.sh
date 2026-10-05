#!/usr/bin/env bash
#
# Runs all three pieces of the CC Livestock / CC Livestock project
# together for local development:
#   1. Backend API        (Express, src/server/index.ts)   -> port 3002
#   2. Web frontend        (Next.js dev server)              -> port 3000
#   3. Mobile Expo dev server (mobile-app/, "Cam Cow Reports")
#
# The API and web servers run in the background with their output logged
# to .dev-logs/; the mobile Expo dev server runs in the foreground of this
# terminal so you can see/scan its QR code with Expo Go. Press Ctrl+C to
# stop everything (API + web + Expo).
#
# Usage:
#   ./scripts/dev-all.sh
# (works from any directory — the script cd's to the repo root itself)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Sanity checks -----------------------------------------------------

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "Missing $REPO_ROOT/.env — copy .env.example to .env and fill it in first." >&2
  exit 1
fi
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "Missing node_modules at repo root — run 'npm install' there first." >&2
  exit 1
fi
if [ ! -f "$REPO_ROOT/mobile-app/.env" ]; then
  echo "Missing mobile-app/.env — copy mobile-app/.env.example to mobile-app/.env" >&2
  echo "and set EXPO_PUBLIC_API_URL to this computer's LAN IP (not localhost)." >&2
  exit 1
fi
if [ ! -d "$REPO_ROOT/mobile-app/node_modules" ]; then
  echo "Missing node_modules in mobile-app/ — run 'npm install' there first." >&2
  exit 1
fi

LOG_DIR="$REPO_ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

# --- Backend API (port comes from .env's PORT=3002) ---------------------

npm run server > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo "API server starting   (pid $API_PID)  -> tail -f $LOG_DIR/api.log"

# --- Web frontend (Next.js dev server, port 3000) -----------------------

npm run dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "Web frontend starting (pid $WEB_PID)  -> tail -f $LOG_DIR/web.log"

# Stop the background processes when this script exits for any reason
# (Ctrl+C included) so nothing keeps running on port 3000/3002 afterward.
cleanup() {
  echo
  echo "Stopping API and web servers..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Give the backend a moment to come up before Expo takes over the terminal.
sleep 2

echo
echo "Web:  http://localhost:3000"
echo "API:  http://localhost:3002/api/v1   (health check: http://localhost:3002/health)"
echo
echo "Starting the mobile Expo dev server — scan the QR code below with Expo Go."
echo "(Ctrl+C here stops the API and web servers too.)"
echo

cd "$REPO_ROOT/mobile-app"
npm start
