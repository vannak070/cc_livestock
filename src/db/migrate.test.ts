import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase, runMigrations } from './migrate';

// Integration test against a real PostgreSQL. It drops every table first, so it
// only runs when RUN_DB_TESTS=1 AND the database name ends in `_test`.
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

describe.skipIf(!enabled)('schema migrations (PostgreSQL)', () => {
  afterAll(() => pool.end());

  it('builds the full schema from nothing and records every migration', async () => {
    await resetDatabase();
    const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).rows.map(r => r.table_name);
    for (const t of ['users', 'stock', 'batches', 'batch_cows', 'weight_tracking', 'sales_tracking', 'health_logs',
      'feed_products', 'feed_transactions', 'proposal_plan', 'master_settings', 'schema_migrations']) {
      expect(tables).toContain(t);
    }
    const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")).rows.map(r => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(['farm_location', 'permissions', 'pin_hash']));
    const ledger = (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r => r.version);
    expect(ledger).toEqual(['001', '002', '003']);
  });

  it('is idempotent: a second run applies nothing', async () => {
    expect(await runMigrations()).toEqual([]);
  });

  it('enforces one automatic ration deduction per reference number', async () => {
    const insert = (id: string) => pool.query(
      "INSERT INTO feed_transactions (id, date, product_id, product_name, type, reference_no) VALUES ($1, now(), 'p', 'p', 'STOCK_OUT', 'AUTO-RATION-B-2026-01-01-0')", [id]);
    await insert('t1');
    await expect(insert('t2')).rejects.toThrow(/uq_feed_tx_auto_ration_ref/);
  });
});
