import { alertSettings } from '../lib/alerts';
import { buildMorningMessages, type FarmMessage } from '../lib/farm-alerts';
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
  /** How many messages went out. */
  sent: number;
  skipped?: 'no-token' | 'not-due' | 'nothing-new';
}

/** Telegram allows about 20 messages a minute to one group: send this many per check, the rest follow on the next one. */
const MAX_PER_RUN = 15;
const PAUSE_MS = 1200;

/**
 * Sends the farm messages to the Telegram group, one message per farm and kind
 * (see lib/farm-alerts.ts): the selling reminder and long-stay cattle every
 * morning. There is no daily report and no 5 pm feed reminder by Telegram
 * (the user skipped both). Each goes out at most once a day per farm.
 * Reads straight from PostgreSQL, never the db.json fallback.
 */
export class DailyAlertService {
  async run(options: { now?: Date; force?: boolean; pauseMs?: number } = {}): Promise<DailyAlertRun> {
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
    if (!options.force && hour < cfg.sendHour) return { sent: 0, skipped: 'not-due' };

    const [stock, weightTracking, batches, feedProducts, feedTransactions, cattleFollowUps] = await Promise.all([
      stockRepository.findAll(), weightRepository.findAll(), batchRepository.findAll(),
      feedRepository.getProducts(), feedRepository.getTransactions(), followUpRepository.findAll().catch(() => []),
    ]);
    const data = { stock, weightTracking, batches, settings, feedProducts, feedTransactions, cattleFollowUps };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || undefined;
    const day = farmToday(now);

    const messages: FarmMessage[] = buildMorningMessages(data, now, { appUrl });

    await dailyAlertLogRepository.cleanup();
    const pause = options.pauseMs ?? PAUSE_MS;
    let sent = 0;
    for (const m of messages) {
      if (sent >= MAX_PER_RUN) break;
      const id = await dailyAlertLogRepository.claim(day, `${m.kind}:${m.farm}`);
      if (id === null) continue; // already sent today, or another server is sending it
      try {
        if (sent > 0 && pause > 0) await new Promise(r => setTimeout(r, pause));
        await telegramService.send(cfg.chatId, m.message);
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
