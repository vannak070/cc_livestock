/**
 * Takes the PRACTICE data added by `npm run practice:seed` out again, found by its markers (ids starting P2-, programs and
 * feed records written by "Practice seed"). The farms' own records are never matched.
 *
 *   npm run practice:remove
 */
import { pool, connectWithRetry } from '../../config/database';
import { settingsRepository } from '../../repositories/settings.repository';
import { PRACTICE_ACTOR } from './practice-data';

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('The practice data is for a local database only.');
  await connectWithRetry(5, 1000);
  const client = await pool.connect();
  const counts: Record<string, number> = {};
  const run = async (label: string, sql: string, params: unknown[] = []) => {
    const r = await client.query(sql, params);
    counts[label] = (counts[label] ?? 0) + (r.rowCount ?? 0);
  };
  try {
    await client.query('BEGIN');
    await run('programs', 'DELETE FROM farm_programs WHERE created_by = $1', [PRACTICE_ACTOR]);
    await run('stock costs', "DELETE FROM camcow_costs WHERE id LIKE 'P2-CST-%'");
    await run('buyers', "DELETE FROM camcow_buyers WHERE id LIKE 'P2-BUY-%'");
    await run('batch cattle', "DELETE FROM batch_cows WHERE batch_id LIKE 'P2-B-%' OR cow_id LIKE 'P2-%'");
    await run('batches', "DELETE FROM batches WHERE id LIKE 'P2-B-%'");
    await run('sales', "DELETE FROM sales_tracking WHERE cow_id LIKE 'P2-%'");
    await run('health', "DELETE FROM health_logs WHERE cow_id LIKE 'P2-%'");
    await run('weighings', "DELETE FROM weight_tracking WHERE cow_id LIKE 'P2-%'");
    await run('registrations', "DELETE FROM cattle_registrations WHERE cow_id LIKE 'P2-%'");
    await run('cattle', "DELETE FROM stock WHERE id LIKE 'P2-%'");
    await run('feed records', 'DELETE FROM feed_transactions WHERE recorded_by = $1 OR id LIKE $2', [PRACTICE_ACTOR, 'P2-TX-%']);
    await run('costs', "DELETE FROM farm_costs WHERE id LIKE 'P2-COST-%'");
    // Give the farms back the cattle limits they had before the seed raised them.
    const changes = (await client.query("SELECT farm_location, old_limit FROM farm_limit_changes WHERE id LIKE 'P2-LIMCHG-%'")).rows as { farm_location: string; old_limit: number }[];
    if (changes.length > 0) {
      const settings = await settingsRepository.getSettings();
      const back = new Map(changes.map(c => [c.farm_location, Number(c.old_limit)]));
      await settingsRepository.patchBlob({ farms: (settings.farms || []).map(f => (back.has(f.name) ? { ...f, capacity: back.get(f.name) } : f)) }, client);
    }
    await run('limit changes', "DELETE FROM farm_limit_changes WHERE id LIKE 'P2-LIMCHG-%'");
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log('[practice] Removed:', Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
}

main()
  .catch(e => { console.error(`[practice] ${e instanceof Error ? e.message : e}`); process.exitCode = 1; })
  .finally(() => pool.end());
