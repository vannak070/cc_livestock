#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# restore-from-backup.sh
# Restores production database from a local JSON backup file.
#
# Usage: bash scripts/restore-from-backup.sh backups/prod_backup_YYYY-MM-DD.json
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROD_HOST="${PROD_HOST:-root@104.248.149.103}"  # override by exporting PROD_HOST before running
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: bash scripts/restore-from-backup.sh <backup-file.json>"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.json 2>/dev/null | awk '{print "   " $NF}' || echo "   (none found)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

CATTLE=$(node -e "const d=require('./$BACKUP_FILE'); console.log(d.stock.length);" 2>/dev/null || echo "?")
CREATED=$(node -e "const d=require('./$BACKUP_FILE'); console.log(d.backup_created_at||'unknown');" 2>/dev/null || echo "?")

echo "=== 🔄 Restore Production Database from Backup ==="
echo "  File    : $BACKUP_FILE"
echo "  Created : $CREATED"
echo "  Cattle  : $CATTLE records"
echo ""
echo "⚠️  WARNING: This will REPLACE all production data with the backup."
read -p "  Type 'YES' to confirm: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "❌ Aborted."
  exit 1
fi

echo ""
echo "[1/2] Uploading backup to production server..."
scp -o StrictHostKeyChecking=no "$BACKUP_FILE" "$PROD_HOST":/tmp/restore_backup.json

echo "[2/2] Restoring data on production server..."
ssh -o StrictHostKeyChecking=no "$PROD_HOST" 'node << '"'"'EOF'"'"'
const fs = require("fs");
require("/root/LiveStock/node_modules/dotenv").config({ path: "/root/LiveStock/.env" });
const { Pool } = require("/root/LiveStock/node_modules/pg");
if (!process.env.DB_PASSWORD) { process.stderr.write("ERROR: DB_PASSWORD not found in /root/LiveStock/.env on the server.\n"); process.exit(1); }
const pool = new Pool({ host:"localhost", port:5432, user:"postgres", password:process.env.DB_PASSWORD, database:(process.env.DB_NAME||"cc_livestock") });
const data = JSON.parse(fs.readFileSync("/tmp/restore_backup.json", "utf8"));

async function restore() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM batch_cows");
    await c.query("DELETE FROM feed_transactions");
    await c.query("DELETE FROM health_logs");
    await c.query("DELETE FROM sales_tracking");
    await c.query("DELETE FROM weight_tracking");
    await c.query("DELETE FROM expenses");
    await c.query("DELETE FROM batches");
    await c.query("DELETE FROM stock");

    for (const s of (data.stock||[])) {
      await c.query("INSERT INTO stock (id,no,breed,sex,age,weight,owner_name,location,phone,buy_type,unit_price,total_price,health_status,status,purchase_date,remark,purchase_type,payment_method,image_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT (id) DO NOTHING",
        [s.id,s.no,s.breed,s.sex,s.age,s.weight,s.owner_name,s.location,s.phone,s.buy_type,s.unit_price,s.total_price,s.health_status,s.status,s.purchase_date,s.remark,s.purchase_type,s.payment_method,s.image_url,s.created_at,s.updated_at]);
    }
    console.log("✓ Cattle:", data.stock.length);

    for (const w of (data.weight_tracking||[])) {
      await c.query("INSERT INTO weight_tracking (cow_id,breed,age,old_weight,current_weight,gain_loss,health_status,status,tracking_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [w.cow_id,w.breed,w.age,w.old_weight,w.current_weight,w.gain_loss,w.health_status,w.status,w.tracking_date]);
    }
    console.log("✓ Weight logs:", data.weight_tracking.length);

    for (const b of (data.batches||[])) {
      await c.query("INSERT INTO batches (id,name,type,start_date,status,notes,farm_location,feeding_program,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING",
        [b.id,b.name,b.type,b.start_date,b.status,b.notes,b.farm_location,b.feeding_program,b.created_at]);
    }
    console.log("✓ Batches:", data.batches.length);

    for (const bc of (data.batch_cows||[])) {
      await c.query("INSERT INTO batch_cows (batch_id,cow_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [bc.batch_id,bc.cow_id]);
    }
    for (const s of (data.sales_tracking||[])) {
      await c.query("INSERT INTO sales_tracking (cow_id,breed,age,weight,unit_price,total_price,status,sales_date,sale_type,buyer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [s.cow_id,s.breed,s.age,s.weight,s.unit_price,s.total_price,s.status,s.sales_date,s.sale_type,s.buyer]);
    }
    for (const e of (data.expenses||[])) {
      if(!e.id) continue;
      await c.query("INSERT INTO expenses (id,category,amount,date,description,farm_location,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [e.id,e.category,e.amount,e.date,e.description,e.farm_location,e.created_at]);
    }
    for (const h of (data.health_logs||[])) {
      if(!h.id) continue;
      await c.query("INSERT INTO health_logs (id,cow_id,type,name,date,administered_by,cost,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING",
        [h.id,h.cow_id,h.type,h.name,h.date,h.administered_by,h.cost,h.notes,h.created_at]);
    }
    await c.query("COMMIT");
    console.log("\n✅ Restore complete!");
  } catch(err) {
    await c.query("ROLLBACK");
    console.error("❌ FAILED (rolled back):", err.message);
    process.exit(1);
  } finally { c.release(); await pool.end(); }
}
restore();
EOF
'

echo ""
echo "✅ Production database restored from: $BACKUP_FILE"
