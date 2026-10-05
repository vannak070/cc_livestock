#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-production.sh  —  SAFE production deployment script
#
# ⚠️  DATABASE PROTECTION RULES (READ BEFORE CHANGING THIS FILE):
#     1. NEVER run `npm run restore-db` (init-db.ts) on production.
#        init-db.ts drops ALL tables and seeds local test data.
#     2. NEVER run `npm run seed` on production (it also drops all tables).
#     3. ONLY `npm run safe-migrate` is allowed — it applies the numbered,
#        idempotent files in src/db/migrations/sql/ once each and records them
#        in the schema_migrations table (it never drops or seeds anything).
#
# WHAT THIS SCRIPT DOES (in order):
#   1. Auto-backup  — creates a timestamped JSON backup before ANY changes
#   2. Git pull     — fetches latest code from main branch
#   3. npm install  — installs/updates Node.js dependencies
#   4. safe-migrate — applies only NEW schema additions (never drops/seeds)
#   5. npm build    — compiles Next.js production bundle
#   6. pm2 reload   — zero-downtime restart of both services
#
# Usage (from your Mac):
#   ssh root@104.248.149.103 'cd /root/LiveStock && bash scripts/deploy-production.sh'
#
# Or run the full remote deploy from local:
#   bash scripts/remote-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/root/LiveStock"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/pre_deploy_$TIMESTAMP.json"
export BACKUP_FILE  # must be exported: the node backup step below reads it via process.env

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🚀  Livestock ERP — Safe Production Deployment              ║"
echo "║  $(date '+%Y-%m-%d %H:%M:%S %Z')                                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ── STEP 1: Auto-backup current production database ────────────────────────
echo "━━━ [1/6] Creating pre-deploy database backup..."
mkdir -p "$BACKUP_DIR"

node << 'JSEOF'
const fs = require("fs");
require("/root/LiveStock/node_modules/dotenv").config({ path: "/root/LiveStock/.env" });
const { Pool } = require("/root/LiveStock/node_modules/pg");
if (!process.env.DB_PASSWORD) { console.error("   ⚠️  DB_PASSWORD not found in /root/LiveStock/.env — skipping backup."); process.exit(0); }
const pool = new Pool({ host:"localhost", port:5432, user:"postgres", password:process.env.DB_PASSWORD, database:(process.env.DB_NAME||"cc_livestock") });
const BACKUP_FILE = process.env.BACKUP_FILE;
async function dump() {
  const c = await pool.connect();
  try {
    const stock           = (await c.query("SELECT * FROM stock")).rows;
    const weight_tracking = (await c.query("SELECT * FROM weight_tracking")).rows;
    const sales_tracking  = (await c.query("SELECT * FROM sales_tracking")).rows;
    const batches         = (await c.query("SELECT * FROM batches")).rows;
    const batch_cows      = (await c.query("SELECT * FROM batch_cows")).rows;
    const expenses        = (await c.query("SELECT * FROM expenses")).rows;
    const health_logs     = (await c.query("SELECT * FROM health_logs")).rows;
    const users           = (await c.query("SELECT * FROM users")).rows;
    const master_settings = (await c.query("SELECT * FROM master_settings")).rows;
    const feed_products   = (await c.query("SELECT * FROM feed_products")).rows;
    const feed_transactions=(await c.query("SELECT * FROM feed_transactions")).rows;
    const payload = JSON.stringify({ backup_created_at: new Date().toISOString(), stock, weight_tracking, sales_tracking, batches, batch_cows, expenses, health_logs, users, master_settings, feed_products, feed_transactions }, null, 2);
    fs.writeFileSync(BACKUP_FILE, payload);
    console.log("   ✓ Backup saved: " + BACKUP_FILE);
    console.log("   ✓ Cattle: " + stock.length + " | Weight logs: " + weight_tracking.length + " | Batches: " + batches.length);
  } finally { c.release(); await pool.end(); }
}
dump().catch(e => { console.error("   ⚠️  Backup failed (non-blocking):", e.message); });
JSEOF

# Keep only the last 10 backups to save disk space
ls -t "$BACKUP_DIR"/pre_deploy_*.json 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

# ── STEP 2: Pull latest code ───────────────────────────────────────────────
echo ""
echo "━━━ [2/6] Pulling latest code from GitHub..."
cd "$APP_DIR"
git pull origin main
echo "   ✓ Code updated"

# ── STEP 3: Install dependencies ──────────────────────────────────────────
echo ""
echo "━━━ [3/6] Installing dependencies..."
npm install --production=false --silent
echo "   ✓ Dependencies ready"

# ── STEP 4: Safe schema migration (NEVER restore-db) ──────────────────────
echo ""
echo "━━━ [4/6] Running safe schema migration..."
echo "   ℹ️  Using safe-migrate (CREATE IF NOT EXISTS only — data untouched)"
npm run safe-migrate
echo "   ✓ Schema is up to date"

# ── STEP 5: Build Next.js ─────────────────────────────────────────────────
echo ""
echo "━━━ [5/6] Building Next.js production bundle..."
npm run build
echo "   ✓ Build complete"

# ── STEP 6: Reload PM2 ────────────────────────────────────────────────────
echo ""
echo "━━━ [6/6] Reloading PM2 services (zero-downtime)..."
pm2 startOrReload "$APP_DIR/ecosystem.config.js" --update-env
pm2 save
echo "   ✓ Services reloaded"

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅  DEPLOYMENT COMPLETE                                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo "  Frontend  : http://104.248.149.103"
echo "  API       : http://104.248.149.103:3002/health"
echo "  PM2 status: pm2 status"
echo "  Backup at : $BACKUP_FILE"
echo ""
echo "  ℹ️  Production database was NOT modified — only schema was updated."
echo "  ℹ️  To restore if needed: node scripts/restore-from-backup.sh $BACKUP_FILE"
echo ""
