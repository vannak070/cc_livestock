import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { dailyFeedService } from '../services/daily-feed.service';
import { feedRepository } from '../repositories/feed.repository';
import { farmToday, addDays } from '../lib/daily-feed';
import { batchMoveService } from '../services/batch-move.service';
import { settingsRepository } from '../repositories/settings.repository';
import type { UserRoleItem } from '../lib/types';

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

  it('a recorded day replaces an old automatic estimate for that day, and recording again replaces the record', async () => {
    // Estimates written by the automatic job that existed before 2026-10-05.
    await pool.query("INSERT INTO feed_transactions (id, date, product_id, product_name, type, quantity_bags, quantity_kg, reference_no) VALUES ('old', $1, 'DSR', 'DSR', 'STOCK_OUT', 9, 270, $2)", [today, `AUTO-RATION-BULLS-${today}-0`]);

    await dailyFeedService.record(farmStaff, day(6));
    expect(await rows()).toEqual([
      { reference_no: `DAILY-BULLS-${today}-DSR`, units: 6, kg: 180, recorded_by: 'Dara' },
      { reference_no: `DAILY-BULLS-${today}-GRASS`, units: 450, kg: 450, recorded_by: 'Dara' },
    ]);

    await dailyFeedService.record(office, day(5, 400));
    expect((await rows()).map(r => [r.units, r.recorded_by])).toEqual([[5, 'Office'], [400, 'Office']]);
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

  it('moves a batch to another farm with its cattle still on the farm, and only the office may', async () => {
    await settingsRepository.patchBlob({ farms: [{ id: 'F1', name: 'SNR Farm' }, { id: 'F2', name: 'Other Farm' }] });
    await pool.query("INSERT INTO stock (id, no, sex, location, status) VALUES ('B3', '3', 'Male', 'SNR Farm', 'Sold')");
    await pool.query("INSERT INTO batch_cows (batch_id, cow_id) VALUES ('BULLS', 'B3')");
    await expect(batchMoveService.moveToFarm(farmStaff, 'BULLS', 'Other Farm', true)).rejects.toThrow(/own farm/);
    await expect(batchMoveService.moveToFarm(office, 'BULLS', 'Nowhere', true)).rejects.toThrow(/from the list/);
    expect(await batchMoveService.moveToFarm(office, 'BULLS', 'Other Farm', true)).toEqual({ cattleMoved: 2 });
    const where = Object.fromEntries((await pool.query('SELECT id, location FROM stock')).rows.map(r => [r.id, r.location]));
    expect(where).toEqual({ B1: 'Other Farm', B2: 'Other Farm', B3: 'SNR Farm' }); // the sold one stays where it was sold
    expect((await pool.query("SELECT farm_location FROM batches WHERE id = 'BULLS'")).rows[0].farm_location).toBe('Other Farm');
    expect(await batchMoveService.moveToFarm(office, 'BULLS', 'SNR Farm', false)).toEqual({ cattleMoved: 0 });
    expect((await pool.query("SELECT location FROM stock WHERE id = 'B1'")).rows[0].location).toBe('Other Farm');
  });

  it('moves one animal into another active batch on its farm', async () => {
    await pool.query("INSERT INTO batches (id, name, type, status, farm_location) VALUES ('B-NEW', 'New bulls', 'Fattening Program', 'Active', 'SNR Farm'), ('B-SHUT', 'Old', 'Fattening Program', 'Closed', 'SNR Farm'), ('B-AWAY', 'Away', 'Fattening Program', 'Active', 'Other Farm')");
    await batchMoveService.moveCow(farmStaff, 'B1', 'BULLS', 'B-NEW');
    const rows = (await pool.query("SELECT batch_id FROM batch_cows WHERE cow_id = 'B1'")).rows.map(r => r.batch_id);
    expect(rows).toEqual(['B-NEW']);
    await expect(batchMoveService.moveCow(office, 'B2', 'BULLS', 'B-SHUT')).rejects.toThrow(/closed/);
    await expect(batchMoveService.moveCow(office, 'B2', 'BULLS', 'B-AWAY')).rejects.toThrow(/Other Farm/);
    await expect(batchMoveService.moveCow(office, 'B1', 'BULLS', 'B-NEW')).rejects.toThrow(/no longer in this batch/);
  });

  it('keeps whether a feed is grown on the farm', async () => {
    await feedRepository.saveProduct({ id: 'STRAW', name: 'Straw', category: 'Roughage', unit: 'bale', weightPerUnit: 20, unitCost: 0, minThresholdBags: 0, minThresholdKg: 0, status: 'Active', trackStock: false });
    const products = await feedRepository.getProducts();
    expect(products.find(p => p.id === 'STRAW')?.trackStock).toBe(false);
    expect(products.find(p => p.id === 'DSR')?.trackStock).toBe(true);
  });

  it('nothing leaves stock unless someone records it', async () => {
    expect(await rows()).toEqual([]);
  });
});
