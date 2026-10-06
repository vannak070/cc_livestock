import { alertSettings } from '../lib/alerts';
import { buildLowFeedAlert, lowFeedNow, planLowFeedAlerts } from '../lib/low-feed-alerts';
import { batchRepository } from '../repositories/batch.repository';
import { feedRepository } from '../repositories/feed.repository';
import { lowFeedAlertLogRepository } from '../repositories/low-feed-alert-log.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { stockRepository } from '../repositories/stock.repository';
import { telegramService } from './telegram.service';

export interface LowFeedAlertRun {
  /** How many alerts went out. */
  sent: number;
  skipped?: 'no-token' | 'off' | 'nothing-new';
}

/** At most this many alerts in one go; the rest follow on the next check. */
const MAX_PER_RUN = 8;

/**
 * Sends a Telegram alert as soon as a farm's feed that is in use drops to its
 * minimum, once per farm and feed, and arms it again when the farm restocks.
 * Not tied to the daily hour. The log makes it safe to call as often as you
 * like. Reads straight from PostgreSQL, never the db.json fallback.
 */
export class LowFeedAlertService {
  async run(options: { force?: boolean } = {}): Promise<LowFeedAlertRun> {
    if (!telegramService.isConfigured()) return { sent: 0, skipped: 'no-token' };
    // Real messages only from servers meant to send them (production, or ALERTS_SCHEDULER=on).
    if (!options.force && !telegramService.sendingAllowedHere()) return { sent: 0, skipped: 'off' };

    const settings = await settingsRepository.getSettings();
    const cfg = alertSettings(settings);
    if (options.force) {
      if (!cfg.telegramEnabled) throw new Error('Switch alerts on and save first.');
      if (!cfg.chatId) throw new Error('Choose and save the Telegram group first.');
    } else if (!cfg.telegramEnabled || !cfg.chatId) {
      return { sent: 0, skipped: 'off' };
    }

    const [stock, batches, feedProducts, feedTransactions] = await Promise.all([
      stockRepository.findAll(), batchRepository.findAll(), feedRepository.getProducts(), feedRepository.getTransactions(),
    ]);
    const low = lowFeedNow({ stock, batches, settings, feedProducts, feedTransactions });

    await lowFeedAlertLogRepository.cleanup();
    const { announce, rearm } = planLowFeedAlerts(low, await lowFeedAlertLogRepository.sent());
    for (const r of rearm) await lowFeedAlertLogRepository.rearm(r.farm, r.productId);
    if (announce.length === 0) return { sent: 0, skipped: 'nothing-new' };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || undefined;
    let sent = 0;
    for (const l of announce.slice(0, MAX_PER_RUN)) {
      const id = await lowFeedAlertLogRepository.claim(l.farm, l.productId);
      if (id === null) continue; // another server just sent it
      try {
        await telegramService.send(cfg.chatId, buildLowFeedAlert(l, { appUrl }));
        await lowFeedAlertLogRepository.confirm(id);
        sent++;
      } catch (err) {
        await lowFeedAlertLogRepository.release(id);
        const text = err instanceof Error ? err.message : 'Telegram could not be reached.';
        await this.markRun(text, sent || undefined).catch(() => undefined);
        throw err;
      }
    }
    if (sent > 0) await this.markRun(null, sent).catch(() => undefined);
    return { sent, ...(sent === 0 ? { skipped: 'nothing-new' as const } : {}) };
  }

  /** Remembers the outcome so Settings can show it (shared with the other alerts). */
  private async markRun(error: string | null, sent?: number): Promise<void> {
    const current = (await settingsRepository.getSettings()).alertStatus ?? {};
    const at = new Date().toISOString();
    await settingsRepository.patchBlob({
      alertStatus: {
        ...current,
        lastRunAt: at,
        ...(sent ? { lastSentAt: at, lastSentCount: sent } : { lastSentAt: current.lastSentAt, lastSentCount: current.lastSentCount }),
        lastError: error,
      },
    });
  }
}

export const lowFeedAlertService = new LowFeedAlertService();
