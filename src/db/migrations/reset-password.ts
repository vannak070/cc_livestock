/**
 * ONE-OFF: reset a single user's login password directly in the `users`
 * table, bypassing the app's own generated-temp-password flow (useful when
 * that one-time console printout was missed/lost).
 *
 * Run:  npx tsx src/db/migrations/reset-password.ts <email> <newPassword>
 */
import { pool, connectWithRetry } from '../../config/database';
import { hashPassword } from '../../lib/password';

async function run() {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error('Usage: npx tsx src/db/migrations/reset-password.ts <email> <newPassword>');
    process.exit(1);
  }

  await connectWithRetry(5, 1000);
  const hashed = await hashPassword(newPassword);

  const res = await pool.query(
    'UPDATE users SET password = $1, sessions_valid_after = now() WHERE LOWER(email) = LOWER($2) RETURNING id, email, role',
    [hashed, email]
  );

  if (res.rowCount === 0) {
    console.error(`No user found with email "${email}". Existing users:`);
    const all = await pool.query('SELECT email, role FROM users ORDER BY created_at ASC');
    all.rows.forEach(r => console.log(`  - ${r.email} (${r.role})`));
    process.exit(1);
  }

  console.log(`Password reset for ${res.rows[0].email} (${res.rows[0].role}). New password: ${newPassword}`);
  await pool.end();
}

run().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
