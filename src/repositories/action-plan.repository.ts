import { QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { BatchContract, ContractInput } from '../lib/action-plans';
import { localDay } from '../lib/local-day';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);
// DATE columns come back as local-midnight Dates: read them with localDay, not toISOString (one day early east of UTC).
const day = (v: unknown) => localDay(v as Date | string | null | undefined);

/** Contracts, one per batch (migration 024). The old farm_action_plans tables stay in the database but nothing reads them any more. */
export class ActionPlanRepository {
  private mapContract(row: QueryResultRow): BatchContract {
    return {
      batchId: row.batch_id,
      contractNo: row.contract_no || '',
      ...(row.buyback_price_per_kg !== null ? { buybackPricePerKg: Number(row.buyback_price_per_kg) } : {}),
      ...(row.delivered_on ? { deliveredOn: day(row.delivered_on) } : {}),
      notes: row.notes || '',
      updatedBy: row.updated_by || '',
      updatedAt: iso(row.updated_at)!,
    };
  }

  async contracts(): Promise<BatchContract[]> {
    const res = await query('SELECT * FROM batch_contracts ORDER BY batch_id');
    return res.rows.map(r => this.mapContract(r));
  }

  async saveContract(batchId: string, c: ContractInput, by: string): Promise<BatchContract> {
    const res = await query(
      `INSERT INTO batch_contracts (batch_id, contract_no, buyback_price_per_kg, delivered_on, notes, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (batch_id) DO UPDATE SET contract_no = EXCLUDED.contract_no, buyback_price_per_kg = EXCLUDED.buyback_price_per_kg,
         delivered_on = EXCLUDED.delivered_on, notes = EXCLUDED.notes, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [batchId, (c.contractNo ?? '').trim(), c.buybackPricePerKg ?? null, c.deliveredOn || null, (c.notes ?? '').trim(), by]
    );
    return this.mapContract(res.rows[0]);
  }
}

export const actionPlanRepository = new ActionPlanRepository();
