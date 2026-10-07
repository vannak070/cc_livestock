#!/usr/bin/env bash
#
# Runs every piece of CC Livestock together for local development:
#   1. Backend API          (Express, src/server/index.ts)   -> port 3002
#   2. Web app               (Next.js dev server)              -> port 3000
#   3. Public CamCow website (website/, its own Next.js app)   -> port 3200
#
# Output is logged to .dev-logs/. Press Ctrl+C to stop all three.
#
# Usage:
#   npm run dev:all
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
if [ ! -d "$REPO_ROOT/website/node_modules" ]; then
  echo "Missing node_modules in website/ — run 'npm run website:install' first." >&2
  exit 1
fi

LOG_DIR="$REPO_ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

npm run server > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
npm run dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
npm run website:dev > "$LOG_DIR/website.log" 2>&1 &
SITE_PID=$!

# Stop everything when this script exits (Ctrl+C included) so nothing keeps
# running on ports 3000/3002/3200 afterward.
cleanup() {
  echo
  echo "Stopping the API, web app and website..."
  kill "$API_PID" "$WEB_PID" "$SITE_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" "$SITE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Web app:  http://localhost:3000          (log: .dev-logs/web.log)"
echo "API:      http://localhost:3002/api/v1   (log: .dev-logs/api.log)"
echo "Website:  http://localhost:3200          (log: .dev-logs/website.log)"
echo "Press Ctrl+C to stop all three."
wait
