/**
 * RESTORE PROD DATA SNAPSHOT TO LOCAL DATABASE
 * Reads /tmp/clone_from_prod.json and replaces the data in local PostgreSQL (localhost:5433/cc_livestock)
 */
import fs from 'fs';
import { pool, connectWithRetry } from '../../config/database';
import { runMigrations } from '../migrate';

async function restoreLocal() {
  console.log('=== 🔄 Restoring Production Data Snapshot into Local Database ===');

  if (!fs.existsSync('/tmp/clone_from_prod.json')) {
    console.error('❌ File /tmp/clone_from_prod.json not found');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync('/tmp/clone_from_prod.json', 'utf8'));

  await connectWithRetry(5, 1000);
  await runMigrations(); // the schema comes from the migrations, never from ad-hoc DDL here
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clean local tables
    await client.query('DELETE FROM batch_cows');
    await client.query('DELETE FROM feed_transactions');
    await client.query('DELETE FROM health_logs');
    await client.query('DELETE FROM sales_tracking');
    await client.query('DELETE FROM weight_tracking');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM batches');
    await client.query('DELETE FROM stock');
    await client.query('DELETE FROM feed_products');
    await client.query('DELETE FROM users'); // local accounts are replaced by production's, passwords included

    // Copy every column that exists in BOTH the production snapshot and the
    // local table. Production's schema drifts ahead of (and sometimes behind)
    // local ones, so hard-coded column lists silently drop data or fail.
    const localColumns = async (table: string): Promise<string[]> =>
      (await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
        [table]
      )).rows.map(r => r.column_name as string);

    const copyTable = async (table: string, rows: Record<string, unknown>[], opts: { requireId?: boolean; upsertKey?: string } = {}) => {
      const cols = await localColumns(table);
      let copied = 0;
      for (const row of rows || []) {
        if (opts.requireId && !row.id) continue;
        const keys = Object.keys(row).filter(k => cols.includes(k));
        const values = keys.map(k => {
          const v = row[k];
          return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
        });
        const conflict = opts.upsertKey
          ? `ON CONFLICT (${opts.upsertKey}) DO UPDATE SET ${keys.filter(k => k !== opts.upsertKey).map(k => `${k}=EXCLUDED.${k}`).join(', ')}`
          : 'ON CONFLICT DO NOTHING';
        await client.query(
          `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) ${conflict}`,
          values
        );
        copied++;
      }
      console.log(`  ${table}: ${copied} rows`);
    };

    // Parents before children (foreign keys).
    await copyTable('stock', data.stock);
    await copyTable('weight_tracking', data.weight_tracking);
    await copyTable('batches', data.batches);
    await copyTable('batch_cows', data.batch_cows);
    await copyTable('sales_tracking', data.sales_tracking);
    await copyTable('expenses', data.expenses, { requireId: true });
    await copyTable('health_logs', data.health_logs, { requireId: true });
    await copyTable('feed_products', data.feed_products);
    await copyTable('feed_transactions', data.feed_transactions);
    await copyTable('users', data.users);
    await copyTable('master_settings', data.master_settings, { upsertKey: 'key' });

    // Rows were inserted with explicit ids, so push any serial sequences past them.
    const seqs = await client.query(`
      SELECT c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
      FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.column_default LIKE 'nextval%'`);
    for (const { table_name, column_name, seq } of seqs.rows) {
      if (seq) await client.query(`SELECT setval($1, COALESCE((SELECT MAX(${column_name}) FROM ${table_name}), 0) + 1, false)`, [seq]);
    }

    await client.query('COMMIT');
    console.log('✅ Local database populated with production data successfully!');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to restore local database:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

restoreLocal();
