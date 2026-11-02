import { randomUUID } from 'crypto';
import { QueryResultRow } from 'pg';
import { query } from '../config/database';
import { localDay } from '../lib/local-day';
import type { CostInput, StockCost } from '../lib/camcow-costs';

/** Costs of keeping cattle at CamCow's stock site (migration 032). */
export class CamcowCostRepository {
  private map(r: QueryResultRow): StockCost {
    return { id: r.id, date: localDay(r.cost_date as Date | string)!, kind: r.kind, amount: Number(r.amount), note: r.note };
  }

  async all(): Promise<StockCost[]> {
    return (await query('SELECT * FROM camcow_costs ORDER BY cost_date DESC, recorded_at DESC')).rows.map(r => this.map(r));
  }
  async find(id: string): Promise<StockCost | null> {
    const res = await query('SELECT * FROM camcow_costs WHERE id = $1', [id]);
    return res.rows[0] ? this.map(res.rows[0]) : null;
  }
  async insert(i: CostInput, by: string): Promise<void> {
    await query('INSERT INTO camcow_costs (id, cost_date, kind, amount, note, recorded_by) VALUES ($1,$2,$3,$4,$5,$6)', [`CST-${randomUUID().slice(0, 10)}`, i.date, i.kind, i.amount, (i.note ?? '').trim(), by]);
  }
  async remove(id: string): Promise<void> {
    await query('DELETE FROM camcow_costs WHERE id = $1', [id]);
  }
}

export const camcowCostRepository = new CamcowCostRepository();
