/**
 * Reports what is actually stored in PostgreSQL, next to what the read-only
 * db.json snapshot contains.
 *
 * PostgreSQL is the system's single source of truth — the app reads and
 * writes nothing else. This script exists to answer two questions directly:
 *   1. Is the database this app is configured to use the one holding my data?
 *   2. Does db.json contain anything that never made it into the database?
 *
 * Run:  npm run db:check
 */
import fs from 'fs';
import path from 'path';
import { pool, connectWithRetry } from '../../config/database';

interface Row { label: string; table: string; jsonKey: string | null }

const CHECKS: Row[] = [
  { label: 'Users (login accounts)', table: 'users', jsonKey: null },
  { label: 'Cattle / stock', table: 'stock', jsonKey: 'stock' },
  { label: 'Weight records', table: 'weight_tracking', jsonKey: 'weightTracking' },
  { label: 'Sales records', table: 'sales_tracking', jsonKey: 'salesTracking' },
  { label: 'Batches', table: 'batches', jsonKey: 'batches' },
  { label: 'Health logs', table: 'health_logs', jsonKey: 'healthLogs' },
  { label: 'Expenses', table: 'expenses', jsonKey: 'expenses' }
];

async function countTable(table: string): Promise<number | null> {
  try {
    const res = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    return res.rows[0].n as number;
  } catch {
    return null; // table missing — schema not applied yet
  }
}

async function run() {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    name: process.env.DB_NAME || 'cc_livestock'
  };
  console.log(`Database in use: ${cfg.host}:${cfg.port}/${cfg.name}  (from .env)`);
  console.log('');

  await connectWithRetry(5, 1000);

  let snapshot: Record<string, unknown[]> = {};
  const snapshotPath = path.join(process.cwd(), 'src/data/db.json');
  if (fs.existsSync(snapshotPath)) {
    try {
      snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      console.warn('(db.json exists but could not be parsed)');
    }
  }

  console.log('  RECORD TYPE                 IN DATABASE     IN db.json SNAPSHOT');
  console.log('  ' + '-'.repeat(66));

  let onlyInSnapshot = 0;
  for (const c of CHECKS) {
    const dbCount = await countTable(c.table);
    const jsonCount = c.jsonKey && Array.isArray(snapshot[c.jsonKey]) ? (snapshot[c.jsonKey] as unknown[]).length : null;

    const dbText = dbCount === null ? 'table missing' : String(dbCount);
    const jsonText = jsonCount === null ? '—' : String(jsonCount);

    let flag = '';
    if (dbCount !== null && jsonCount !== null && jsonCount > dbCount) {
      flag = '  <-- snapshot has more';
      onlyInSnapshot++;
    }
    console.log(`  ${c.label.padEnd(28)}${dbText.padEnd(16)}${jsonText}${flag}`);
  }

  console.log('');

  const users = await countTable('users');
  if (users === 0) {
    console.log('No login accounts exist in this database yet.');
    console.log('Create the first one with:  npm run create-admin -- <email> <password> "Full Name"');
  } else if (users !== null) {
    const list = await pool.query('SELECT email, role, status FROM users ORDER BY created_at ASC');
    console.log(`${users} login account(s) in the database:`);
    list.rows.forEach(r => console.log(`  - ${r.email}  (${r.role}, ${r.status})`));
    console.log('Forgot a password? Set it with:  npm run reset-password -- <email> <newPassword>');
  }

  if (onlyInSnapshot > 0) {
    console.log('');
    console.log(`WARNING: ${onlyInSnapshot} record type(s) have more rows in db.json than in the database.`);
    console.log('Those records exist only in the local snapshot file and are NOT in the database,');
    console.log('so the app will not show them. Import them with:  npm run seed');
  }

  await pool.end();
}

run().catch(err => {
  console.error('db:check failed:', err instanceof Error ? err.message : err);
  console.error('If this is a connection error, the app cannot reach this database either.');
  console.error('Check DB_HOST / DB_PORT / DB_NAME in .env and that PostgreSQL is running.');
  process.exit(1);
});
