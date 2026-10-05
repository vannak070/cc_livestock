import { query } from '../config/database';
import { ProposalPlanParams, ProposalPlanRecord } from '../types/proposal.types';

// Single global "current plan" row — id is always 'current'. There is no
// per-user or per-farm plan; whoever last saves it sets what everyone sees,
// same as the web ProposalPlanTab.tsx's own single shared simulation.
const SINGLETON_ID = 'current';

export class ProposalPlanRepository {
  async get(): Promise<ProposalPlanRecord | null> {
    const res = await query('SELECT params, updated_at FROM proposal_plan WHERE id = $1', [SINGLETON_ID]);
    if (res.rows.length === 0) return null;
    return {
      params: res.rows[0].params,
      updatedAt: new Date(res.rows[0].updated_at).toISOString()
    };
  }

  async save(params: ProposalPlanParams): Promise<ProposalPlanRecord> {
    const res = await query(
      `INSERT INTO proposal_plan (id, params, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET params = EXCLUDED.params, updated_at = CURRENT_TIMESTAMP
       RETURNING params, updated_at`,
      [SINGLETON_ID, JSON.stringify(params)]
    );
    return {
      params: res.rows[0].params,
      updatedAt: new Date(res.rows[0].updated_at).toISOString()
    };
  }
}

export const proposalPlanRepository = new ProposalPlanRepository();
