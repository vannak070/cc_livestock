import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { CattleRegistration } from '../lib/types';
import { FARM_TIME_ZONE } from '../lib/daily-feed';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);

/** The permanent record of every cattle registration (migration 016); the monthly bill is built from it. */
export class RegistrationRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  private map(row: QueryResultRow): CattleRegistration {
    return {
      cowId: row.cow_id,
      farm: row.farm_location || '',
      month: row.month,
      registeredAt: iso(row.registered_at)!,
      registeredBy: row.registered_by || '',
      ...(row.removed_at ? { removedAt: iso(row.removed_at) } : {}),
      ...(row.removed_by ? { removedBy: row.removed_by } : {}),
      ...(row.removed_reason ? { removedReason: row.removed_reason } : {}),
    };
  }

  /** Writes one registration; called in the same transaction that creates the animal. */
  async record(cowId: string, farm: string, by: string, client?: PoolClient): Promise<void> {
    await this.run('INSERT INTO cattle_registrations (cow_id, farm_location, registered_by) VALUES ($1, $2, $3)', [cowId, farm ?? '', by], client);
  }

  /** Marks an animal's live registration as removed (it was a mistake). Returns whether one was found. */
  async markRemoved(cowId: string, by: string, reason: string, client?: PoolClient): Promise<boolean> {
    const res = await this.run(
      'UPDATE cattle_registrations SET removed_at = CURRENT_TIMESTAMP, removed_by = $2, removed_reason = $3 WHERE cow_id = $1 AND removed_at IS NULL',
      [cowId, by, reason],
      client
    );
    return (res.rowCount ?? 0) > 0;
  }

  /** Registrations from `fromMonth` to `toMonth` (inclusive, YYYY-MM) on the farm's calendar. */
  async between(fromMonth: string, toMonth: string): Promise<CattleRegistration[]> {
    const res = await query(
      `SELECT cow_id, farm_location, registered_at, registered_by, removed_at, removed_by, removed_reason,
              to_char(registered_at AT TIME ZONE '${FARM_TIME_ZONE}', 'YYYY-MM') AS month
       FROM cattle_registrations
       WHERE to_char(registered_at AT TIME ZONE '${FARM_TIME_ZONE}', 'YYYY-MM') BETWEEN $1 AND $2
       ORDER BY registered_at DESC, id DESC`,
      [fromMonth, toMonth]
    );
    return res.rows.map(r => this.map(r));
  }
}

export const registrationRepository = new RegistrationRepository();
