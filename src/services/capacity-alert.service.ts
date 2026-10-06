import { alertSettings } from '../lib/alerts';
import { buildCapacityAlert, capacityLevels, planCapacityAlerts } from '../lib/capacity-alerts';
import { capacityAlertLogRepository } from '../repositories/capacity-alert-log.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { stockRepository } from '../repositories/stock.repository';
import { telegramService } from './telegram.service';

export interface CapacityAlertRun {
  /** How many farm warnings went out. */
  sent: number;
  skipped?: 'no-token' | 'off' | 'nothing-new';
}

/** At most this many warnings in one go; the rest follow on the next check. */
const MAX_PER_RUN = 8;

/**
 * Sends a Telegram warning when a farm reaches 80%, 90% or 100% of its cattle
 * limit. Not tied to the daily hour: running out of room blocks registering, so
 * it is announced at the next check (every few minutes) or right after a
 * registration. The log makes it safe to call as often as you like.
 * Reads straight from PostgreSQL, never the db.json fallback.
 */
export class CapacityAlertService {
  async run(options: { force?: boolean } = {}): Promise<CapacityAlertRun> {
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

    const levels = capacityLevels(settings.farms ?? [], await stockRepository.findAll());
    await capacityAlertLogRepository.cleanup();
    const plan = planCapacityAlerts(levels, await capacityAlertLogRepository.sent());
    if (plan.length === 0) return { sent: 0, skipped: 'nothing-new' };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || undefined;
    let sent = 0;
    for (const level of plan.slice(0, MAX_PER_RUN)) {
      const id = await capacityAlertLogRepository.claim(level.farm, level.limit, level.step);
      if (id === null) continue; // another server just sent it
      try {
        await telegramService.send(cfg.chatId, buildCapacityAlert(level, { appUrl }));
        await capacityAlertLogRepository.confirm(id);
        await capacityAlertLogRepository.markPassed(level.farm, level.limit, level.step);
        sent++;
      } catch (err) {
        await capacityAlertLogRepository.release(id);
        const text = err instanceof Error ? err.message : 'Telegram could not be reached.';
        await this.markRun(text, sent || undefined).catch(() => undefined);
        throw err;
      }
    }
    if (sent > 0) await this.markRun(null, sent).catch(() => undefined);
    return { sent, ...(sent === 0 ? { skipped: 'nothing-new' as const } : {}) };
  }

  /** Remembers the outcome so Settings can show it (shared with the sale alerts). */
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

export const capacityAlertService = new CapacityAlertService();
