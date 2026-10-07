/**
 * Creates (or updates) the database account the public CamCow website uses
 * for its forms and visitor counts (docs/website/README.md). It can only
 * INSERT new rows into website_applications, website_inquiries,
 * website_photos (photos sent with a Join application) and website_events
 * (page views and button presses): it cannot read them, or anything else in
 * CC Livestock.
 *
 *   WEBSITE_FORMS_DB_PASSWORD=... npx tsx src/db/create-website-forms-user.ts
 *
 * Put the same user (camcow_website) and password in the website project's
 * .env.local as FORMS_DATABASE_URL. Run again to change the password.
 */
import { query } from '../config/database';

const USER = 'camcow_website';

async function main() {
  const password = process.env.WEBSITE_FORMS_DB_PASSWORD?.trim();
  if (!password || password.length < 16) throw new Error('Set WEBSITE_FORMS_DB_PASSWORD (at least 16 characters).');
  const quoted = `'${password.replace(/'/g, "''")}'`;
  const exists = (await query('SELECT 1 FROM pg_roles WHERE rolname = $1', [USER])).rows.length > 0;
  await query(`${exists ? 'ALTER' : 'CREATE'} ROLE ${USER} WITH LOGIN PASSWORD ${quoted} NOSUPERUSER NOCREATEDB NOCREATEROLE`, []);
  const db = (await query('SELECT current_database() AS d', [])).rows[0].d as string;
  await query(`REVOKE ALL ON DATABASE "${db}" FROM ${USER}`, []);
  await query(`GRANT CONNECT ON DATABASE "${db}" TO ${USER}`, []);
  await query(`GRANT USAGE ON SCHEMA public TO ${USER}`, []);
  await query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${USER}`, []);
  await query(`GRANT INSERT ON website_applications, website_inquiries, website_photos, website_events TO ${USER}`, []);
  console.log(`${exists ? 'Updated' : 'Created'} ${USER}: INSERT on website_applications, website_inquiries, website_photos and website_events only.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
