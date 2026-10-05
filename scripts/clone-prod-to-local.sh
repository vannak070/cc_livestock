#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# clone-prod-to-local.sh
# Clones ALL production data from http://104.248.149.103 into your local
# PostgreSQL (localhost:5433/cc_livestock).  Useful for local development
# and testing with real data.
#
# Usage: bash scripts/clone-prod-to-local.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROD_HOST="${PROD_HOST:-root@104.248.149.103}"  # override by exporting PROD_HOST before running
LOCAL_HOST="localhost"
LOCAL_PORT="5433"
LOCAL_USER="postgres"
LOCAL_PASS="postgres123"
LOCAL_DB="cc_livestock"

echo "=== 📦 Clone Production → Local Development Environment ==="
echo "  Source : $PROD_HOST (production)"
echo "  Target : $LOCAL_USER@$LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB"
echo ""

# Step 1: Dump from production
echo "[1/3] Dumping data from production..."
ssh -o StrictHostKeyChecking=no "$PROD_HOST" 'node << '"'"'EOF'"'"'
require("/root/LiveStock/node_modules/dotenv").config({ path: "/root/LiveStock/.env" });
const { Pool } = require("/root/LiveStock/node_modules/pg");
if (!process.env.DB_PASSWORD) { process.stderr.write("ERROR: DB_PASSWORD not found in /root/LiveStock/.env on the server.\n"); process.exit(1); }
const pool = new Pool({ host:"localhost", port:5432, user:"postgres", password:process.env.DB_PASSWORD, database:(process.env.DB_NAME||"cc_livestock") });
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
    process.stdout.write(JSON.stringify({ stock, weight_tracking, sales_tracking, batches, batch_cows, expenses, health_logs, users, master_settings, feed_products, feed_transactions }));
  } finally { c.release(); await pool.end(); }
}
dump().catch(e => { process.stderr.write("ERROR: "+e.message+"\n"); process.exit(1); });
EOF
' > /tmp/clone_from_prod.json

CATTLE=$(node -e "const d=require('/tmp/clone_from_prod.json'); console.log(d.stock.length);" 2>/dev/null || echo "?")
echo "   Cattle fetched: $CATTLE records"

# Step 2: Restore into local DB
echo "[2/3] Restoring into local PostgreSQL ($LOCAL_HOST:$LOCAL_PORT)..."
DB_HOST="$LOCAL_HOST" DB_PORT="$LOCAL_PORT" DB_USER="$LOCAL_USER" DB_PASSWORD="$LOCAL_PASS" DB_NAME="$LOCAL_DB" \
  npx tsx "$(dirname "$0")/../src/db/migrations/clone-restore-local.ts" 2>&1

echo "[3/3] Verifying local database..."
VERIFY=$(DB_HOST="$LOCAL_HOST" DB_PORT="$LOCAL_PORT" DB_USER="$LOCAL_USER" DB_PASSWORD="$LOCAL_PASS" DB_NAME="$LOCAL_DB" \
  node -e "
const { Pool } = require('./node_modules/pg');
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
async function v() {
  const c = await pool.connect();
  const s = (await c.query('SELECT COUNT(*) FROM stock')).rows[0].count;
  const w = (await c.query('SELECT COUNT(*) FROM weight_tracking')).rows[0].count;
  const b = (await c.query('SELECT COUNT(*) FROM batches')).rows[0].count;
  c.release(); await pool.end();
  console.log('Cattle: ' + s + ' | Weight: ' + w + ' | Batches: ' + b);
}
v().catch(e => console.error(e.message));
" 2>&1)

echo ""
echo "✅ Production data cloned to local environment!"
echo "   $VERIFY"
echo ""
echo "📋 Synchronized Database Summary:"
echo "   ┌─────────────────────────────────────────────────────┐"
echo "   │ Table              │ Count                          │"
echo "   ├─────────────────────────────────────────────────────┤"
node -e "
const d = require('/tmp/clone_from_prod.json');
const rows = [
  ['Cattle Stock (stock)',          d.stock.length + ' records'],
  ['Weight Tracking',               d.weight_tracking.length + ' records'],
  ['Sales Tracking',                d.sales_tracking.length + ' records'],
  ['Fattening Batches',             d.batches.length + ' records'],
  ['Feed Products',                 d.feed_products.length + ' records'],
  ['Feed Transactions',             d.feed_transactions.length + ' records'],
  ['Users',                         d.users.length + ' accounts'],
  ['Master Settings',               'Synced'],
];
rows.forEach(([k,v]) => {
  const pad = ' '.repeat(Math.max(0, 20 - k.length));
  console.log('   │ ' + k + pad + '│ ' + v);
});
" 2>/dev/null || true
echo "   └─────────────────────────────────────────────────────┘"
echo ""
echo "🖥️  Local Environment:"
echo "   Frontend  : http://localhost:3000"
echo "   API       : http://localhost:3002/health"
echo "   PostgreSQL: postgres@$LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB"
