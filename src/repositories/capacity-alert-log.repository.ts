import { query } from '../config/database';
import type { SentCapacityAlert } from '../lib/capacity-alerts';

/** Minutes after which an unconfirmed claim (the server stopped mid-send) is forgotten. */
const STALE_MINUTES = 30;

export class CapacityAlertLogRepository {
  /** Forgets claims that never got confirmed, so their warnings can be sent again. */
  async cleanup(): Promise<void> {
    await query(`DELETE FROM capacity_alert_log WHERE confirmed = false AND claimed_at < now() - ($1 || ' minutes')::interval`, [String(STALE_MINUTES)]);
  }

  /** Warnings sent (or being sent right now). */
  async sent(): Promise<SentCapacityAlert[]> {
    const res = await query(
      `SELECT farm_location, limit_value, step FROM capacity_alert_log
        WHERE confirmed OR claimed_at > now() - ($1 || ' minutes')::interval`,
      [String(STALE_MINUTES)]
    );
    return res.rows.map(r => ({ farm: r.farm_location, limit: Number(r.limit_value), step: Number(r.step) }));
  }

  /** Takes the right to send one warning; false when another server already took it. */
  async claim(farm: string, limit: number, step: number): Promise<number | null> {
    const res = await query(
      `INSERT INTO capacity_alert_log (farm_location, limit_value, step) VALUES ($1, $2, $3)
       ON CONFLICT (farm_location, limit_value, step) DO NOTHING RETURNING id`,
      [farm, limit, step]
    );
    return res.rows[0] ? (res.rows[0].id as number) : null;
  }

  async confirm(id: number): Promise<void> {
    await query('UPDATE capacity_alert_log SET confirmed = true WHERE id = $1', [id]);
  }

  /** A farm's lower steps are marked sent when it jumps past them, so they are never announced later. */
  async markPassed(farm: string, limit: number, belowStep: number): Promise<void> {
    await query(
      `INSERT INTO capacity_alert_log (farm_location, limit_value, step, confirmed)
       SELECT $1, $2, s, true FROM unnest(ARRAY[80, 90, 100]) AS s WHERE s < $3
       ON CONFLICT (farm_location, limit_value, step) DO NOTHING`,
      [farm, limit, belowStep]
    );
  }

  /** Sending failed: give the claim back so the next check tries again. */
  async release(id: number): Promise<void> {
    await query('DELETE FROM capacity_alert_log WHERE id = $1 AND confirmed = false', [id]);
  }
}

export const capacityAlertLogRepository = new CapacityAlertLogRepository();
