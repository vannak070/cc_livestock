import { query } from '../config/database';
import type { AlertStage, PlannedAlert, SentAlert } from '../lib/sale-alerts';

/** Minutes after which an unconfirmed claim (the server stopped mid-send) is forgotten. */
const STALE_MINUTES = 30;

export class AlertLogRepository {
  /** Forgets claims that never got confirmed, so their alerts can be sent again. */
  async cleanup(): Promise<void> {
    await query(`DELETE FROM sale_alert_log WHERE confirmed = false AND claimed_at < now() - ($1 || ' minutes')::interval`, [String(STALE_MINUTES)]);
  }

  /** What was sent (or is being sent right now) since a day, dates kept as plain YYYY-MM-DD. */
  async recent(sinceDay: string): Promise<SentAlert[]> {
    const res = await query(
      `SELECT batch_id, target_date::text AS target_date, stage, sent_on::text AS sent_on
         FROM sale_alert_log
        WHERE sent_on >= $1::date AND (confirmed OR claimed_at > now() - ($2 || ' minutes')::interval)`,
      [sinceDay, String(STALE_MINUTES)]
    );
    return res.rows.map(r => ({ batchId: r.batch_id, targetDate: r.target_date, stage: r.stage as AlertStage, sentOn: r.sent_on }));
  }

  /**
   * Takes the right to send each planned alert today. Only the alerts this
   * call newly claimed come back, so two servers can never both send one.
   */
  async claim(plan: PlannedAlert[], today: string): Promise<{ id: number; item: PlannedAlert }[]> {
    const claimed: { id: number; item: PlannedAlert }[] = [];
    for (const item of plan) {
      const res = await query(
        `INSERT INTO sale_alert_log (batch_id, target_date, stage, sent_on) VALUES ($1, $2::date, $3, $4::date)
         ON CONFLICT (batch_id, target_date, stage, sent_on) DO NOTHING RETURNING id`,
        [item.row.batch.id, item.targetDate, item.stage, today]
      );
      if (res.rows[0]) claimed.push({ id: res.rows[0].id as number, item });
    }
    return claimed;
  }

  async confirm(ids: number[]): Promise<void> {
    if (ids.length) await query('UPDATE sale_alert_log SET confirmed = true WHERE id = ANY($1)', [ids]);
  }

  /** Sending failed: give the claims back so the next check tries again. */
  async release(ids: number[]): Promise<void> {
    if (ids.length) await query('DELETE FROM sale_alert_log WHERE id = ANY($1) AND confirmed = false', [ids]);
  }
}

export const alertLogRepository = new AlertLogRepository();
