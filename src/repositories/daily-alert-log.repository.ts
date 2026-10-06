import { query } from '../config/database';

/** Minutes after which an unconfirmed claim (the server stopped mid-send) is forgotten. */
const STALE_MINUTES = 30;

export class DailyAlertLogRepository {
  /** Forgets claims that never got confirmed, and rows older than a month. */
  async cleanup(): Promise<void> {
    await query(`DELETE FROM daily_alert_log WHERE (confirmed = false AND claimed_at < now() - ($1 || ' minutes')::interval) OR sent_on < CURRENT_DATE - 31`, [String(STALE_MINUTES)]);
  }

  /** Takes the right to send one day's message; null when it was already sent or another server is sending it. */
  async claim(day: string, kind: string): Promise<number | null> {
    const res = await query(
      `INSERT INTO daily_alert_log (sent_on, kind) VALUES ($1, $2) ON CONFLICT (sent_on, kind) DO NOTHING RETURNING id`,
      [day, kind]
    );
    return res.rows[0] ? (res.rows[0].id as number) : null;
  }

  async confirm(id: number): Promise<void> {
    await query('UPDATE daily_alert_log SET confirmed = true WHERE id = $1', [id]);
  }

  async release(id: number): Promise<void> {
    await query('DELETE FROM daily_alert_log WHERE id = $1 AND confirmed = false', [id]);
  }
}

export const dailyAlertLogRepository = new DailyAlertLogRepository();
