import { query } from '../config/database';
import type { SentLowFeed } from '../lib/low-feed-alerts';

/** Minutes after which an unconfirmed claim (the server stopped mid-send) is forgotten. */
const STALE_MINUTES = 30;

export class LowFeedAlertLogRepository {
  /** Forgets claims that never got confirmed, so their alerts can be sent again. */
  async cleanup(): Promise<void> {
    await query(`DELETE FROM low_feed_alert_log WHERE confirmed = false AND claimed_at < now() - ($1 || ' minutes')::interval`, [String(STALE_MINUTES)]);
  }

  /** Alerts sent (or being sent right now). */
  async sent(): Promise<SentLowFeed[]> {
    const res = await query(
      `SELECT farm_location, product_id FROM low_feed_alert_log WHERE confirmed OR claimed_at > now() - ($1 || ' minutes')::interval`,
      [String(STALE_MINUTES)]
    );
    return res.rows.map(r => ({ farm: r.farm_location as string, productId: r.product_id as string }));
  }

  /** Takes the right to send one alert; null when another server already took it. */
  async claim(farm: string, productId: string): Promise<number | null> {
    const res = await query(
      `INSERT INTO low_feed_alert_log (farm_location, product_id) VALUES ($1, $2) ON CONFLICT (farm_location, product_id) DO NOTHING RETURNING id`,
      [farm, productId]
    );
    return res.rows[0] ? (res.rows[0].id as number) : null;
  }

  async confirm(id: number): Promise<void> {
    await query('UPDATE low_feed_alert_log SET confirmed = true WHERE id = $1', [id]);
  }

  /** Sending failed: give the claim back so the next check tries again. */
  async release(id: number): Promise<void> {
    await query('DELETE FROM low_feed_alert_log WHERE id = $1 AND confirmed = false', [id]);
  }

  /** The feed is above its minimum again: arm it for the next drop. */
  async rearm(farm: string, productId: string): Promise<void> {
    await query('DELETE FROM low_feed_alert_log WHERE farm_location = $1 AND product_id = $2 AND confirmed', [farm, productId]);
  }
}

export const lowFeedAlertLogRepository = new LowFeedAlertLogRepository();
