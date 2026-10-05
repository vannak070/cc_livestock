import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { scopeFor, type FarmScope } from '../lib/farm-scope';
import { scopeDataForActor } from '../lib/data-scope';
import { stockRepository } from '../repositories/stock.repository';
import { weightRepository } from '../repositories/weight.repository';
import { salesRepository } from '../repositories/sales.repository';
import { healthRepository } from '../repositories/health.repository';
import { batchRepository } from '../repositories/batch.repository';
import type { ERPLivestockData, UserRoleItem } from '../lib/types';

// Integration test: needs RUN_DB_TESTS=1 and a database whose name ends in `_test` (it drops every table).
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

const LOCATIONS: Record<string, string | null> = {
  A1: 'Farm A', A2: ' FARM A ', B1: 'Farm B', R1: 'រទាំង', R2: 'SNR Farm', R3: 'snr-2', N1: null, E1: ''
};

describe.skipIf(!enabled)('SQL farm scope matches the in-memory scope', () => {
  beforeAll(async () => {
    await resetDatabase();
    for (const [id, loc] of Object.entries(LOCATIONS)) {
      await pool.query("INSERT INTO stock (id, no, location) VALUES ($1, $1, $2)", [id, loc]);
      await pool.query("INSERT INTO weight_tracking (cow_id, current_weight, tracking_date) VALUES ($1, 100, now()), ($1, 110, now() + interval '1 day')", [id]);
      await pool.query("INSERT INTO sales_tracking (cow_id, total_price) VALUES ($1, 5)", [id]);
      await pool.query("INSERT INTO health_logs (id, cow_id, type, name) VALUES ('H-' || $1, $1, 'Treatment', 'x')", [id]);
    }
    await pool.query(`INSERT INTO batches (id, name, type, farm_location) VALUES
      ('BT-A','a','F','Farm A'), ('BT-B-MIXED','b','F','Farm B'), ('BT-B-EMPTY','c','F','Farm B'),
      ('BT-NULL','d','F',NULL), ('BT-BLANK','e','F',''), ('BT-R','f','F','SNR Farm')`);
    await pool.query(`INSERT INTO batch_cows VALUES
      ('BT-A','A1'),('BT-A','B1'),('BT-B-MIXED','B1'),('BT-B-MIXED','A2'),('BT-B-EMPTY','B1'),('BT-R','R1'),('BT-R','A1')`);
  });
  afterAll(() => pool.end());

  const unscoped = async (): Promise<ERPLivestockData> => ({
    stock: await stockRepository.findAll(),
    weightTracking: await weightRepository.findAll(),
    salesTracking: await salesRepository.findAll(),
    healthLogs: await healthRepository.findAll(),
    batches: await batchRepository.findAll(),
    common: { locations: [] },
    settings: { users: [] }
  } as unknown as ERPLivestockData);

  const scopedInSql = async (scope: FarmScope) => ({
    stock: await stockRepository.findAll(scope),
    weightTracking: await weightRepository.findAll(scope),
    salesTracking: await salesRepository.findAll(scope),
    healthLogs: await healthRepository.findAll(scope),
    batches: await batchRepository.findAll(scope)
  });

  const shape = (d: Pick<ERPLivestockData, 'stock' | 'weightTracking' | 'salesTracking' | 'healthLogs' | 'batches'>) => ({
    stock: d.stock.map(c => c.id),
    weights: d.weightTracking.map(w => `${w.cowId}:${w.currentWeight}`),
    sales: d.salesTracking.map(s => s.cowId),
    health: d.healthLogs.map(h => h.id),
    batches: d.batches.map(b => `${b.id}[${[...b.cowIds].sort().join(',')}]`)
  });

  it.each(['Farm A', '  farm a', 'Farm B', 'រទាំង', 'SNR Farm', 'snr-2', 'Nowhere'])(
    'returns the same rows as scopeDataForActor for farm %j', async farm => {
      const actor = { id: 'u', name: 'u', email: 'u@x.test', role: 'Farm Owner', status: 'Active', farmLocation: farm } as UserRoleItem;
      const inMemory = scopeDataForActor(await unscoped(), actor);
      const inSql = await scopedInSql(scopeFor(actor)!);
      expect(shape(inSql)).toEqual(shape(inMemory));
    }
  );

  it('actually narrows: Farm A does not see Farm B cattle, and the scope excludes empty locations', async () => {
    const out = await scopedInSql({ farmLocation: 'Farm A' });
    expect(out.stock.map(c => c.id).sort()).toEqual(['A1', 'A2']);
    expect(out.batches.map(b => b.id)).not.toContain('BT-B-EMPTY');
    expect(out.batches.find(b => b.id === 'BT-B-MIXED')!.cowIds).toEqual(['A2']);
  });

  it('with no scope still returns everything', async () => {
    expect((await stockRepository.findAll()).length).toBe(Object.keys(LOCATIONS).length);
  });
});
