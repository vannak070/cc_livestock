import { alertSettings } from '../../lib/alerts';
import { REQUEST_KEEP_MONTHS, buildPublishFailedMessage, buildPublishRecoveredMessage, publishAlertDue } from '../../lib/website';
import { withTransaction } from '../../config/database';
import { settingsRepository } from '../../repositories/settings.repository';
import { websiteRequestRepository } from '../../repositories/website';
import { telegramService } from '../telegram.service';

/**
 * Background upkeep for the public website, run by the API process's
 * website scheduler (src/server/website-scheduler.ts):
 * - tells the CamCow Telegram group once when publishing starts failing and
 *   once when it works again (same rules as the other alerts: only where
 *   sending is allowed and with alerts switched on);
 * - deletes website requests older than 24 months (personal data is not kept
 *   longer than needed).
 */
export class WebsiteUpkeepService {
  async alertPublishProblems(): Promise<'failed' | 'recovered' | null> {
    if (!telegramService.isConfigured() || !telegramService.sendingAllowedHere()) return null;
    const settings = await settingsRepository.getSettings();
    const cfg = alertSettings(settings);
    if (!cfg.telegramEnabled || !cfg.chatId) return null;
    const status = settings.websiteStatus;
    const due = publishAlertDue(status);
    if (!due || !status) return null;
    await telegramService.send(cfg.chatId, due === 'failed' ? buildPublishFailedMessage(status) : buildPublishRecoveredMessage());
    // Re-read so a publish that finished meanwhile is not overwritten.
    const latest = (await settingsRepository.getSettings()).websiteStatus ?? status;
    await settingsRepository.patchBlob({ websiteStatus: { ...latest, failureAlertedAt: due === 'failed' ? new Date().toISOString() : null } });
    return due;
  }

  async deleteOldRequests(): Promise<{ applications: number; inquiries: number; photos: number }> {
    return withTransaction(client => websiteRequestRepository.deleteOlderThan(REQUEST_KEEP_MONTHS, client));
  }
}

export const websiteUpkeepService = new WebsiteUpkeepService();
