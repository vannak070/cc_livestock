import { alertSettings } from '../lib/alerts';
import { addDays, farmToday } from '../lib/daily-feed';
import { alertsDue, batchAlertDetail, buildSaleAlertHeader, buildSaleAlertMessages, planSaleAlerts } from '../lib/sale-alerts';
import { MAX_MESSAGES } from '../lib/sale-alerts';
import { saleReviewRows, saleWindowDays } from '../lib/sale-review';
import { alertLogRepository } from '../repositories/alert-log.repository';
import { batchRepository } from '../repositories/batch.repository';
import { feedRepository } from '../repositories/feed.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { stockRepository } from '../repositories/stock.repository';
import { weightRepository } from '../repositories/weight.repository';
import { telegramService } from './telegram.service';

export interface SaleAlertRun {
  /** How many batches were in the message that was sent. */
  sent: number;
  /** Why nothing was sent, when nothing was. */
  skipped?: 'no-token' | 'not-due' | 'nothing-new';
}

/** Looks back this many days in the log when deciding what was already sent. */
const LOOKBACK_DAYS = 30;

/**
 * Sends the sale-review alerts to the Telegram group: the batches that newly
 * reached a stage, plus reminders for ones still past their selling date.
 * Safe to call as often as you like; the log stops anything going out twice.
 * It reads straight from PostgreSQL, never the db.json fallback, so a database
 * outage can never cause alerts built from stale data.
 */
export class SaleAlertService {
  async run(options: { now?: Date; force?: boolean } = {}): Promise<SaleAlertRun> {
    const now = options.now ?? new Date();
    if (!telegramService.isConfigured()) return { sent: 0, skipped: 'no-token' };

    const settings = await settingsRepository.getSettings();
    const cfg = alertSettings(settings);
    if (options.force) {
      if (!cfg.telegramEnabled) throw new Error('Switch alerts on and save first.');
      if (!cfg.chatId) throw new Error('Choose and save the Telegram group first.');
    } else if (!alertsDue(cfg, now)) {
      return { sent: 0, skipped: 'not-due' };
    }

    const today = farmToday(now);
    const [batches, stock, weights, products] = await Promise.all([
      batchRepository.findAll(), stockRepository.findAll(), weightRepository.findAll(), feedRepository.getProducts(),
    ]);
    const windowDays = saleWindowDays(settings);
    const rows = saleReviewRows(batches, stock, weights, products, now, windowDays);

    await alertLogRepository.cleanup();
    const plan = planSaleAlerts(rows, await alertLogRepository.recent(addDays(today, -LOOKBACK_DAYS)), today);
    if (plan.length === 0) {
      await this.markRun(null);
      return { sent: 0, skipped: 'nothing-new' };
    }

    // Newest-worst first, and no more than one go's worth of messages; the rest follow on the next check.
    const claimed = await alertLogRepository.claim(plan.slice(0, MAX_MESSAGES), today);
    if (claimed.length === 0) return { sent: 0, skipped: 'nothing-new' }; // another server just sent them
    const claimIds = new Map(claimed.map(c => [c.item, c.id]));
    const { items } = buildSaleAlertMessages(
      claimed.map(c => c.item),
      alert => batchAlertDetail(alert.row.batch, stock, weights, today),
      { today, appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || undefined }
    );
    // The header counts everything due, even the batches that follow on a later check.
    const headerText = plan.length > 1 ? buildSaleAlertHeader(plan, { today, sending: claimed.length }) : null;

    let sent = 0;
    try {
      if (headerText) await telegramService.send(cfg.chatId, headerText);
      for (const item of items) {
        await telegramService.send(cfg.chatId, item.text);
        await alertLogRepository.confirm([claimIds.get(item.alert)!]);
        sent++;
      }
      await this.markRun(null, sent);
      return { sent };
    } catch (err) {
      // What went out stays recorded; only the batches not yet sent are given back to try again.
      await alertLogRepository.release(items.slice(sent).map(i => claimIds.get(i.alert)!));
      const text = err instanceof Error ? err.message : 'Telegram could not be reached.';
      await this.markRun(text, sent || undefined).catch(() => undefined);
      throw err;
    }
  }

  /** Remembers the outcome so Settings can show it; written only when something worth showing happened. */
  private async markRun(error: string | null, sent?: number): Promise<void> {
    const current = (await settingsRepository.getSettings()).alertStatus ?? {};
    const at = new Date().toISOString();
    const next = {
      ...current,
      lastRunAt: at,
      ...(sent ? { lastSentAt: at, lastSentCount: sent } : { lastSentAt: current.lastSentAt, lastSentCount: current.lastSentCount }),
      lastError: error,
    };
    // Skip the write when nothing changed except the clock, so quiet checks do not touch settings every few minutes.
    if (!sent && !error && !current.lastError) return;
    await settingsRepository.patchBlob({ alertStatus: next });
  }
}

export const saleAlertService = new SaleAlertService();
