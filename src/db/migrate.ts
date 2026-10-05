import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pool, connectWithRetry } from '../config/database';

/**
 * Versioned, non-destructive schema migrations.
 *
 * Every file in src/db/migrations/sql/ (NNN_name.sql, applied in filename
 * order) runs once, inside its own transaction, and is recorded in the
 * `schema_migrations` ledger. Files must be idempotent (IF NOT EXISTS) so the
 * first run on an existing production database simply records them. A file
 * that changes after it was applied is refused: add a new numbered file instead.
 */
const MIGRATIONS_DIR = path.join(__dirname, 'migrations', 'sql');
const LOCK_KEY = 727274; // arbitrary constant: serialises concurrent migrators

// Every table the app owns, children first. Only used by resetDatabase().
const ALL_TABLES = [
  'batch_cows', 'weight_tracking', 'sales_tracking', 'health_logs', 'batches',
  'feed_transactions', 'feed_products', 'proposal_plans', 'proposal_plan', 'farm_costs', 'expenses', 'stock',
  'users', 'master_settings', 'schema_migrations'
];

interface MigrationFile { version: string; name: string; sql: string; checksum: string }

function loadMigrations(): MigrationFile[] {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map(file => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      return {
        version: file.split('_')[0],
        name: file,
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex')
      };
    });
}

/** Applies every pending migration. Returns the names applied this run. */
export async function runMigrations(): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(20) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const done = new Map<string, string>(
      (await client.query('SELECT version, checksum FROM schema_migrations')).rows.map(r => [r.version, r.checksum])
    );

    for (const m of loadMigrations()) {
      const prior = done.get(m.version);
      if (prior) {
        if (prior !== m.checksum) {
          throw new Error(`Migration ${m.name} was changed after it was applied. Never edit an applied migration; add a new numbered file.`);
        }
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
        applied.push(m.name);
        console.log(`[migrate] applied ${m.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.name} failed and was rolled back: ${err instanceof Error ? err.message : err}`);
      }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

/** DESTRUCTIVE: drops every app table, then re-migrates. Local development only. */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetDatabase() drops every table and is refused when NODE_ENV=production.');
  }
  for (const table of ALL_TABLES) {
    await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  await runMigrations();
}

// CLI: `npm run safe-migrate`
if (require.main === module) {
  (async () => {
    try {
      await connectWithRetry(5, 2000);
      const applied = await runMigrations();
      console.log(applied.length ? `\n✅ ${applied.length} migration(s) applied. Existing data untouched.` : '\n✅ Database schema already up to date.');
      await pool.end();
    } catch (err) {
      console.error('\n❌', err instanceof Error ? err.message : err);
      await pool.end().catch(() => undefined);
      process.exit(1);
    }
  })();
}
