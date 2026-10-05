import type { QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { FarmLoanAssumptions, FarmLoanRecord, FarmLoanTerms } from '../lib/types';

// One loan per farm, keyed by the farm's name (moved by farmRepository.renameEverywhere).
function toRecord(row: QueryResultRow): FarmLoanRecord {
  return {
    farmLocation: row.farm_location,
    terms: row.terms as FarmLoanTerms,
    assumptions: row.assumptions as FarmLoanAssumptions,
    notes: row.notes || '',
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.updated_by ? { updatedBy: row.updated_by as string } : {}),
  };
}

export class FarmLoanRepository {
  async findAll(): Promise<FarmLoanRecord[]> {
    const res = await query('SELECT * FROM farm_loans ORDER BY farm_location');
    return res.rows.map(toRecord);
  }

  async save(farm: string, terms: FarmLoanTerms, assumptions: FarmLoanAssumptions, notes: string, updatedBy?: string): Promise<FarmLoanRecord> {
    const res = await query(
      `INSERT INTO farm_loans (farm_location, terms, assumptions, notes, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (farm_location) DO UPDATE
         SET terms = EXCLUDED.terms, assumptions = EXCLUDED.assumptions, notes = EXCLUDED.notes,
             updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [farm, JSON.stringify(terms), JSON.stringify(assumptions), notes, updatedBy ?? null]
    );
    return toRecord(res.rows[0]);
  }

  async delete(farm: string): Promise<boolean> {
    const res = await query('DELETE FROM farm_loans WHERE farm_location = $1 RETURNING farm_location', [farm]);
    return res.rows.length > 0;
  }
}

export const farmLoanRepository = new FarmLoanRepository();
