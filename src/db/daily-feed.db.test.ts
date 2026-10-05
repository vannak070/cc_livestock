import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { dailyFeedService } from '../services/daily-feed.service';
import { processDailyFeedStockOuts } from '../lib/daily-feed-cron';
import { feedRepository } from '../repositories/feed.repository';
import { batchService } from '../services/batch.service';
import { stockService } from '../services/stock.service';
import { farmToday, addDays } from '../lib/daily-feed';
import type { ERPLivestockData, UserRoleItem } from '../lib/types';

// Integration test: needs RUN_DB_TESTS=1 and a database whose name ends in `_test` (it drops every table).
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

const office = { id: 'ad', name: 'Office', email: 'ad@x.com', role: 'Admin', status: 'Active' } as UserRoleItem;
const farmStaff = { id: 'st', name: 'Dara', email: 'st@x.com', role: 'Farm Staff', status: 'Active', farmLocation: 'SNR Farm' } as UserRoleItem;
const otherFarm = { ...farmStaff, id: 'st2', name: 'Sok', farmLocation: 'Other Farm' } as UserRoleItem;

const today = farmToday();
const rows = async () => (await pool.query("SELECT reference_no, quantity_bags::float AS units, quantity_kg::float AS kg, recorded_by FROM feed_transactions ORDER BY reference_no")).rows;
const day = (units: number, grass = 450) => ({
  farm: 'SNR Farm', day: today,
  batches: [{ batchId: 'BULLS', items: [{ productId: 'DSR', units }, { productId: 'GRASS', units: grass }] }],
});
const runJob = async () => processDailyFeedStockOuts({
  stock: await stockService.getAllStock(), batches: await batchService.getAllBatches(),
  feedProducts: await feedRepository.getProducts(), feedTransactions: await feedRepository.getTransactions(),
} as ERPLivestockData);

describe.skipIf(!enabled)('daily feed records', () => {
  beforeAll(async () => { await resetDatabase(); });
  afterAll(() => pool.end());
  beforeEach(async () => {
    for (const t of ['feed_transactions', 'feed_products', 'batch_cows', 'batches', 'stock']) await pool.query(`DELETE FROM ${t}`);
    await pool.query("INSERT INTO feed_products (id, name, category, unit, weight_per_unit, unit_cost) VALUES ('DSR', 'DSR-16 Cow Feed', 'Concentrate', 'bag', 30, 1000), ('GRASS', 'Fresh Grass', 'Grass', 'kg', 1, 100)");
    await pool.query("INSERT INTO stock (id, no, sex, location, status) VALUES ('B1', '1', 'Male', 'SNR Farm', 'Active'), ('B2', '2', 'Male', 'SNR Farm', 'Active')");
    const program = { status: 'Active', frequency: 'Once Daily', startDate: '2026-01-01', ingredients: [
      { name: 'ចំណីសំរេច (DSR-16)', productId: 'DSR', portionPerHead: 6, unitCost: 1000 },
      { name: 'Fresh Grass', productId: 'GRASS', portionPerHead: 15, unitCost: 100 },
    ] };
    await pool.query("INSERT INTO batches (id, name, type, status, farm_location, start_date, feeding_program) VALUES ('BULLS', 'Bulls', 'Fattening Program', 'Active', 'SNR Farm', '2026-01-01', $1)", [JSON.stringify(program)]);
    await pool.query("INSERT INTO batch_cows (batch_id, cow_id) VALUES ('BULLS', 'B1'), ('BULLS', 'B2')");
  });

  it('a recorded day replaces that day\'s estimate, and recording again replaces the record', async () => {
    expect(await runJob()).toBe(2); // estimate for today: DSR + grass
    expect((await rows()).every(r => r.reference_no.startsWith('AUTO-RATION-'))).toBe(true);

    await dailyFeedService.record(farmStaff, day(6));
    expect(await rows()).toEqual([
      { reference_no: `DAILY-BULLS-${today}-DSR`, units: 6, kg: 180, recorded_by: 'Dara' },
      { reference_no: `DAILY-BULLS-${today}-GRASS`, units: 450, kg: 450, recorded_by: 'Dara' },
    ]);

    await dailyFeedService.record(office, day(5, 400));
    expect((await rows()).map(r => [r.units, r.recorded_by])).toEqual([[5, 'Office'], [400, 'Office']]);
    expect(await runJob()).toBe(0); // a recorded day is never estimated again
  });

  it('a farm account records only its own farm; the office can record any farm', async () => {
    await expect(dailyFeedService.record(otherFarm, day(6))).rejects.toThrow(/own farm/);
    await expect(dailyFeedService.record(office, day(6))).resolves.toEqual({ rows: 2 });
  });

  it('refuses future days, unknown batches and feeds', async () => {
    await expect(dailyFeedService.record(office, { ...day(6), day: addDays(today, 1) })).rejects.toThrow(/not happened/);
    await expect(dailyFeedService.record(office, { ...day(6), batches: [{ batchId: 'NOPE', items: [{ productId: 'DSR', units: 1 }] }] })).rejects.toThrow(/not being fed/);
    await expect(dailyFeedService.record(office, { ...day(6), batches: [{ batchId: 'BULLS', items: [] }] })).rejects.toThrow(/no feed to record/);
    await expect(dailyFeedService.record(office, { ...day(6), batches: [{ batchId: 'BULLS', items: [{ productId: 'GONE', units: 1 }] }] })).rejects.toThrow(/no longer in the feed list/);
    expect(await rows()).toEqual([]);
  });

  it('a new batch is estimated from today only, not back to its start date', async () => {
    expect(await runJob()).toBe(2);
    expect((await rows()).map(r => r.reference_no)).toEqual([`AUTO-RATION-BULLS-${today}-DSR`, `AUTO-RATION-BULLS-${today}-GRASS`]);
  });
});
