/**
 * Takes the DEMO data added by `npm run demo:seed` out again, found by its markers (ids starting DEMO-, farms called
 * "DEMO Farm ...", logins demo.*@cclivestock.local). Real records are never matched.
 *
 *   npm run demo:remove
 */
import fs from 'fs';
import path from 'path';
import { pool, connectWithRetry } from '../../config/database';
import { settingsRepository } from '../../repositories/settings.repository';
import { DEMO_MARK_BEGIN, DEMO_MARK_END } from './markers';

const ACCOUNTS_FILE = path.join(process.cwd(), '.local', 'test-accounts.md');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('The demo data is for a local database only.');
  await connectWithRetry(5, 1000);

  const client = await pool.connect();
  const counts: Record<string, number> = {};
  const run = async (label: string, sql: string, params: unknown[] = []) => {
    const r = await client.query(sql, params);
    counts[label] = (counts[label] ?? 0) + (r.rowCount ?? 0);
  };
  try {
    await client.query('BEGIN');
    const farms = "farm_location LIKE 'DEMO Farm%'";
    await run('programs', `DELETE FROM farm_programs WHERE ${farms}`);
    await run('contracts', "DELETE FROM batch_contracts WHERE batch_id LIKE 'DEMO-B-%'");
    await run('batch cattle', "DELETE FROM batch_cows WHERE batch_id LIKE 'DEMO-B-%' OR cow_id LIKE 'DEMO-%'");
    await run('batches', "DELETE FROM batches WHERE id LIKE 'DEMO-B-%'");
    await run('follow-ups', "DELETE FROM cattle_follow_ups WHERE cow_id LIKE 'DEMO-%' OR id LIKE 'DEMO-%'");
    await run('sales', "DELETE FROM sales_tracking WHERE cow_id LIKE 'DEMO-%'");
    await run('health', "DELETE FROM health_logs WHERE cow_id LIKE 'DEMO-%'");
    await run('weighings', "DELETE FROM weight_tracking WHERE cow_id LIKE 'DEMO-%'");
    await run('registrations', "DELETE FROM cattle_registrations WHERE cow_id LIKE 'DEMO-%'");
    await run('cattle', "DELETE FROM stock WHERE id LIKE 'DEMO-%'");
    await run('feed records', "DELETE FROM feed_transactions WHERE id LIKE 'DEMO-TX-%' OR source_farm LIKE 'DEMO Farm%' OR target_farm LIKE 'DEMO Farm%'");
    await run('costs', `DELETE FROM farm_costs WHERE ${farms}`);
    await run('limit changes', `DELETE FROM farm_limit_changes WHERE ${farms}`);
    await run('limit requests', `DELETE FROM farm_limit_requests WHERE ${farms}`);
    await run('alert logs', `DELETE FROM low_feed_alert_log WHERE ${farms}`);
    await run('alert logs', `DELETE FROM capacity_alert_log WHERE ${farms}`);
    await run('alert logs', "DELETE FROM sale_alert_log WHERE batch_id LIKE 'DEMO-B-%'");
    await run('feed products', "DELETE FROM feed_products WHERE id LIKE 'PROD-DEMO-%'");
    await run('logins', "DELETE FROM users WHERE email LIKE 'demo.%@cclivestock.local'");

    const settings = await settingsRepository.getSettings();
    const keep = (settings.farms || []).filter(f => !f.name.startsWith('DEMO Farm'));
    counts.farms = (settings.farms || []).length - keep.length;
    if (counts.farms > 0) await settingsRepository.patchBlob({ farms: keep }, client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  if (fs.existsSync(ACCOUNTS_FILE)) {
    const text = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const a = text.indexOf(DEMO_MARK_BEGIN);
    const b = text.indexOf(DEMO_MARK_END);
    if (a >= 0 && b > a) fs.writeFileSync(ACCOUNTS_FILE, `${text.slice(0, a).trimEnd()}\n${text.slice(b + DEMO_MARK_END.length).trimStart()}`.trimEnd() + '\n', { mode: 0o600 });
  }
  console.log('[demo] Removed:', Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
}

main()
  .catch(e => { console.error(`[demo] ${e instanceof Error ? e.message : e}`); process.exitCode = 1; })
  .finally(() => pool.end());
