import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { stockService } from '../services/stock.service';

// Integration test: needs RUN_DB_TESTS=1 and a database whose name ends in `_test` (it drops every table).
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

describe.skipIf(!enabled)('renaming a farm moves its cattle and its batches', () => {
  beforeAll(async () => {
    await resetDatabase();
    await pool.query("INSERT INTO stock (id, no, location) VALUES ('A1','A1','Farm A'), ('A2','A2','Farm A'), ('B1','B1','Farm B')");
    await pool.query("INSERT INTO batches (id, name, type, farm_location) VALUES ('BT-A','a','F','Farm A'), ('BT-B','b','F','Farm B'), ('BT-NONE','c','F',NULL)");
  });
  afterAll(() => pool.end());

  it('renames both together and leaves other farms alone', async () => {
    await stockService.updateStockLocation('Farm A', 'Farm A2');
    const stock = await pool.query('SELECT id, location FROM stock ORDER BY id');
    expect(stock.rows).toEqual([{ id: 'A1', location: 'Farm A2' }, { id: 'A2', location: 'Farm A2' }, { id: 'B1', location: 'Farm B' }]);
    const batches = await pool.query('SELECT id, farm_location FROM batches ORDER BY id');
    expect(batches.rows).toEqual([{ id: 'BT-A', farm_location: 'Farm A2' }, { id: 'BT-B', farm_location: 'Farm B' }, { id: 'BT-NONE', farm_location: null }]);
  });
});
