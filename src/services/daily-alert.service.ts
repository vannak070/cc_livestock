import { alertSettings } from '../lib/alerts';
import { buildDailyDigest, EVENING_HOUR, type DigestKind } from '../lib/daily-digest';
import { farmToday } from '../lib/daily-feed';
import { farmHour } from '../lib/sale-alerts';
import { dailyAlertLogRepository } from '../repositories/daily-alert-log.repository';
import { batchRepository } from '../repositories/batch.repository';
import { feedRepository } from '../repositories/feed.repository';
import { followUpRepository } from '../repositories/follow-up.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { stockRepository } from '../repositories/stock.repository';
import { weightRepository } from '../repositories/weight.repository';
import { telegramService } from './telegram.service';

export interface DailyAlertRun {
  /** How many messages went out (0 to 2). */
  sent: number;
  skipped?: 'no-token' | 'not-due' | 'nothing-new';
}

/**
 * Sends the daily check-up to the Telegram group: the Today-screen items that
 * are not sale reviews (missed feed days, weighing, long-stay cattle, sick
 * animals, low feed). One "morning" message at the alert hour, and a short
 * "evening" reminder if today's feed is still not written down. Each goes out
 * at most once a day, and nothing is sent on a day with nothing to report.
 * Reads straight from PostgreSQL, never the db.json fallback.
 */
export class DailyAlertService {
  async run(options: { now?: Date; force?: boolean } = {}): Promise<DailyAlertRun> {
    const now = options.now ?? new Date();
    if (!telegramService.isConfigured()) return { sent: 0, skipped: 'no-token' };

    const settings = await settingsRepository.getSettings();
    const cfg = alertSettings(settings);
    if (options.force) {
      if (!cfg.telegramEnabled) throw new Error('Switch alerts on and save first.');
      if (!cfg.chatId) throw new Error('Choose and save the Telegram group first.');
    } else if (!cfg.telegramEnabled || !cfg.chatId) {
      return { sent: 0, skipped: 'not-due' };
    }

    const hour = farmHour(now);
    const kinds: DigestKind[] = [];
    if (options.force || hour >= cfg.sendHour) kinds.push('morning');
    if (!options.force && hour >= EVENING_HOUR) kinds.push('evening');
    if (kinds.length === 0) return { sent: 0, skipped: 'not-due' };

    const [stock, weightTracking, batches, feedProducts, feedTransactions, cattleFollowUps] = await Promise.all([
      stockRepository.findAll(), weightRepository.findAll(), batchRepository.findAll(),
      feedRepository.getProducts(), feedRepository.getTransactions(), followUpRepository.findAll().catch(() => []),
    ]);
    const data = { stock, weightTracking, batches, settings, feedProducts, feedTransactions, cattleFollowUps };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || undefined;
    const day = farmToday(now);

    await dailyAlertLogRepository.cleanup();
    let sent = 0;
    for (const kind of kinds) {
      const { message } = buildDailyDigest(data, now, kind, { appUrl });
      if (!message) continue;
      const id = await dailyAlertLogRepository.claim(day, kind);
      if (id === null) continue; // already sent today, or another server is sending it
      try {
        await telegramService.send(cfg.chatId, message);
        await dailyAlertLogRepository.confirm(id);
        sent++;
      } catch (err) {
        await dailyAlertLogRepository.release(id);
        const text = err instanceof Error ? err.message : 'Telegram could not be reached.';
        await this.markError(text).catch(() => undefined);
        throw err;
      }
    }
    if (sent > 0) await this.markSent(sent).catch(() => undefined);
    return sent > 0 ? { sent } : { sent: 0, skipped: 'nothing-new' };
  }

  /** Shown in Settings next to the sale alerts. */
  private async markSent(count: number): Promise<void> {
    const current = (await settingsRepository.getSettings()).alertStatus ?? {};
    const at = new Date().toISOString();
    await settingsRepository.patchBlob({ alertStatus: { ...current, lastRunAt: at, lastDailyAt: at, lastDailyCount: count, lastError: null } });
  }

  private async markError(error: string): Promise<void> {
    const current = (await settingsRepository.getSettings()).alertStatus ?? {};
    await settingsRepository.patchBlob({ alertStatus: { ...current, lastRunAt: new Date().toISOString(), lastError: error } });
  }
}

export const dailyAlertService = new DailyAlertService();
