/**
 * One command to get a working Super Admin login, with a clear diagnosis at
 * every step if something is in the way.
 *
 * Run:  npm run login-fix -- <password> [email]
 * e.g.  npm run login-fix -- MyPassword123
 */
import { pool, connectWithRetry } from '../../config/database';
import { hashPassword, verifyPassword } from '../../lib/password';
import { DEFAULT_ROLE_PERMISSIONS } from '../../lib/types';

const DEFAULT_EMAIL = 'vannak@snrfarm.com';

function line() { console.log('-'.repeat(64)); }

async function run() {
  const [, , password, emailArg] = process.argv;
  const email = (emailArg || DEFAULT_EMAIL).trim();

  if (!password) {
    console.error('Usage: npm run login-fix -- <password> [email]');
    console.error('e.g.   npm run login-fix -- MyPassword123');
    process.exit(1);
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'cc_livestock';
  const apiPort = process.env.PORT || '3001';

  line();
  console.log(`STEP 1  Connecting to PostgreSQL at ${host}:${port}/${dbName} ...`);
  try {
    await connectWithRetry(3, 1000);
    console.log('        OK - database is reachable.');
  } catch (err) {
    console.error('        FAILED - cannot reach the database.');
    console.error(`        ${err instanceof Error ? err.message : err}`);
    line();
    console.error('This is why you cannot log in: the app talks to this same database.');
    console.error('Start it, then run this command again. If you use Docker:');
    console.error('    docker compose up -d db');
    console.error('Then check it is listening:');
    console.error(`    docker ps --format '{{.Names}}\\t{{.Ports}}'`);
    process.exit(1);
  }

  console.log(`STEP 2  Making sure the users table has the columns the app needs ...`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_location VARCHAR(100)`);
  console.log('        OK.');

  console.log(`STEP 3  Setting up Super Admin "${email}" ...`);
  const hashed = await hashPassword(password);
  const permissions = JSON.stringify(DEFAULT_ROLE_PERMISSIONS['Super Admin'] || []);
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users SET password = $1, role = 'Super Admin', status = 'Active', permissions = $2 WHERE id = $3`,
      [hashed, permissions, existing.rows[0].id]
    );
    console.log('        OK - existing account updated (password set, role Super Admin, status Active).');
  } else {
    const idRes = await pool.query(`SELECT COALESCE(MAX(NULLIF(id, '')::bigint), 0) + 1 AS next_id FROM users WHERE id ~ '^[0-9]+$'`);
    const nextId = String(idRes.rows[0]?.next_id ?? 1);
    await pool.query(
      `INSERT INTO users (id, name, email, role, status, password, permissions)
       VALUES ($1, 'Administrator', $2, 'Super Admin', 'Active', $3, $4)`,
      [nextId, email, hashed, permissions]
    );
    console.log('        OK - new Super Admin account created.');
  }

  console.log('STEP 4  Verifying the password actually works ...');
  const check = await pool.query('SELECT password, status, role FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  const ok = await verifyPassword(password, check.rows[0].password);
  console.log(ok
    ? `        OK - password verified, role ${check.rows[0].role}, status ${check.rows[0].status}.`
    : '        FAILED - stored password did not verify. Tell Claude this happened.');

  console.log(`STEP 5  Checking the backend API is running on port ${apiPort} ...`);
  let apiUp = false;
  try {
    const res = await fetch(`http://localhost:${apiPort}/health`);
    apiUp = res.ok;
  } catch { apiUp = false; }

  if (apiUp) {
    console.log('        OK - the API is running.');
  } else {
    console.log('        NOT RUNNING - this alone will stop you logging in.');
    console.log('        The login form talks to this API, not to Next.js directly.');
    console.log('        Open a second terminal and run:   npm run server');
    console.log('        (or start everything at once with: npm run dev:all)');
  }

  line();
  console.log('LOG IN AT:  http://localhost:3000');
  console.log(`   Email:   ${email}`);
  console.log('   Password: the one you just passed to this command');
  if (!apiUp) {
    console.log('');
    console.log('...but start the API first (npm run server), or the login will fail.');
  }
  line();

  await pool.end();
}

run().catch(err => {
  console.error('');
  console.error('login-fix failed:', err instanceof Error ? err.message : err);
  console.error('Copy everything above and send it to Claude.');
  process.exit(1);
});
