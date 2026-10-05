import type { QueryResultRow } from 'pg';
import { query } from '../config/database';
import { ProposalPlanParams, ProposalPlanRecord } from '../types/proposal.types';

// Up to ten named planning scenarios, slots 1 to 10. They are global: not per
// farm and not per user, so everyone with access sees the same plans.
function toRecord(row: QueryResultRow): ProposalPlanRecord {
  return {
    slot: Number(row.slot),
    name: row.name,
    params: row.params as ProposalPlanParams,
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.updated_by ? { updatedBy: row.updated_by as string } : {}),
  };
}

export class ProposalPlanRepository {
  async findAll(): Promise<ProposalPlanRecord[]> {
    const res = await query('SELECT slot, name, params, updated_by, updated_at FROM proposal_plans ORDER BY slot');
    return res.rows.map(toRecord);
  }

  async save(slot: number, name: string, params: ProposalPlanParams, updatedBy?: string): Promise<ProposalPlanRecord> {
    const res = await query(
      `INSERT INTO proposal_plans (slot, name, params, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (slot) DO UPDATE
         SET name = EXCLUDED.name, params = EXCLUDED.params, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
       RETURNING slot, name, params, updated_by, updated_at`,
      [slot, name, JSON.stringify(params), updatedBy ?? null]
    );
    return toRecord(res.rows[0]);
  }

  async delete(slot: number): Promise<boolean> {
    const res = await query('DELETE FROM proposal_plans WHERE slot = $1 RETURNING slot', [slot]);
    return res.rows.length > 0;
  }
}

export const proposalPlanRepository = new ProposalPlanRepository();
