import fs from 'fs';
import path from 'path';
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
      'feed_products', 'feed_transactions', 'proposal_plan', 'proposal_plans', 'master_settings', 'schema_migrations']) {
      expect(tables).toContain(t);
    }
    const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")).rows.map(r => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(['farm_location', 'permissions', 'pin_hash']));
    const ledger = (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r => r.version);
    expect(ledger).toEqual(['001', '002', '003', '004', '005']);
  });

  it('is idempotent: a second run applies nothing', async () => {
    expect(await runMigrations()).toEqual([]);
  });

  it('005 turns old location names still in use into farms and removes the old list', async () => {
    const data = { breeds: ['B'], farms: [{ id: 'F1', name: 'Farm A', capacity: 40 }], locations: ['Farm A', 'Old Farm', 'Unused', ' Old Farm '] };
    await pool.query("INSERT INTO master_settings (key, data) VALUES ('master_setup', $1) ON CONFLICT (key) DO UPDATE SET data = $1", [JSON.stringify(data)]);
    await pool.query("INSERT INTO stock (id, no, location) VALUES ('C-005', '1', 'Old Farm')");
    await pool.query(fs.readFileSync(path.join(__dirname, 'migrations/sql/005_farms_replace_locations.sql'), 'utf8'));
    const after = (await pool.query("SELECT data FROM master_settings WHERE key = 'master_setup'")).rows[0].data;
    expect(after.farms.map((f: { name: string }) => f.name)).toEqual(['Farm A', 'Old Farm']);
    expect(after.farms[1]).toMatchObject({ capacity: 100 });
    expect(after.farms[1].id).toMatch(/^FARM-[0-9A-F]{8}$/);
    expect('locations' in after).toBe(false);
    expect(after.breeds).toEqual(['B']);
    await pool.query("DELETE FROM stock WHERE id = 'C-005'");
  });

  it('enforces one automatic ration deduction per reference number', async () => {
    const insert = (id: string) => pool.query(
      "INSERT INTO feed_transactions (id, date, product_id, product_name, type, reference_no) VALUES ($1, now(), 'p', 'p', 'STOCK_OUT', 'AUTO-RATION-B-2026-01-01-0')", [id]);
    await insert('t1');
    await expect(insert('t2')).rejects.toThrow(/uq_feed_tx_auto_ration_ref/);
  });
});
