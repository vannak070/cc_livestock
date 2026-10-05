#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# backup-production-db.sh
# Creates a timestamped JSON snapshot of ALL production data via SSH.
# Safe to run any time — read-only, never modifies anything.
#
# Usage: bash scripts/backup-production-db.sh
# Output: backups/prod_backup_YYYY-MM-DD_HH-MM-SS.json
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROD_HOST="${PROD_HOST:-root@104.248.149.103}"  # override by exporting PROD_HOST before running
BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/prod_backup_$TIMESTAMP.json"

mkdir -p "$BACKUP_DIR"

echo "=== 🗄️  Production Database Backup ==="
echo "  Server : $PROD_HOST"
echo "  Output : $BACKUP_FILE"
echo ""

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
    process.stdout.write(JSON.stringify({
      backup_created_at: new Date().toISOString(),
      stock, weight_tracking, sales_tracking, batches, batch_cows,
      expenses, health_logs, users, master_settings, feed_products, feed_transactions
    }, null, 2));
  } finally { c.release(); await pool.end(); }
}
dump().catch(e => { process.stderr.write("ERROR: "+e.message+"\n"); process.exit(1); });
EOF
' > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
CATTLE=$(node -e "const d=require('$BACKUP_FILE'); console.log(d.stock.length);" 2>/dev/null || echo "?")
WEIGHT=$(node -e "const d=require('$BACKUP_FILE'); console.log(d.weight_tracking.length);" 2>/dev/null || echo "?")
BATCHES=$(node -e "const d=require('$BACKUP_FILE'); console.log(d.batches.length);" 2>/dev/null || echo "?")

echo "✅ Backup complete!"
echo "   File    : $BACKUP_FILE ($SIZE)"
echo "   Cattle  : $CATTLE records"
echo "   Weight  : $WEIGHT records"
echo "   Batches : $BATCHES records"
echo ""
echo "To restore: bash scripts/restore-from-backup.sh $BACKUP_FILE"
