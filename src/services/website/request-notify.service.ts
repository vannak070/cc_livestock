import { alertSettings } from '../../lib/alerts';
import { buildApplicationMessage, buildInquiryMessage, farmListingIdOf, listingIdOf } from '../../lib/website';
import { batchRepository } from '../../repositories/batch.repository';
import { settingsRepository } from '../../repositories/settings.repository';
import { websiteRequestRepository } from '../../repositories/website';
import { telegramService } from '../telegram.service';

/**
 * One Telegram message per new website request (application or inquiry),
 * to the CamCow group set in Settings → Alerts. Same safety rules as the
 * other alerts: only where sending is allowed (production, or
 * ALERTS_SCHEDULER=on), only with alerts switched on, and each request is
 * claimed first so two servers never send it twice.
 */
export class WebsiteRequestNotifyService {
  async run(): Promise<{ sent: number; skipped?: string }> {
    if (!telegramService.isConfigured()) return { sent: 0, skipped: 'no-token' };
    if (!telegramService.sendingAllowedHere()) return { sent: 0, skipped: 'off' };
    const cfg = alertSettings(await settingsRepository.getSettings());
    if (!cfg.telegramEnabled || !cfg.chatId) return { sent: 0, skipped: 'off' };

    const { applications, inquiries } = await websiteRequestRepository.findUnnotified();
    if (applications.length + inquiries.length === 0) return { sent: 0, skipped: 'nothing-new' };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || undefined;
    // A price inquiry names a farm (older ones named a batch).
    const names = new Map<string, string>();
    if (inquiries.some(i => i.listingRef)) {
      for (const b of await batchRepository.findAll()) names.set(listingIdOf(b.id), b.name);
      for (const f of (await settingsRepository.getSettings()).farms ?? []) names.set(farmListingIdOf(f.id), f.name);
    }

    let sent = 0;
    const jobs: { kind: 'application' | 'inquiry'; id: string; text: string }[] = [
      ...applications.map(a => ({ kind: 'application' as const, id: a.id, text: buildApplicationMessage(a, appUrl) })),
      ...inquiries.map(i => ({ kind: 'inquiry' as const, id: i.id, text: buildInquiryMessage(i, i.listingRef ? names.get(i.listingRef) : undefined, appUrl) })),
    ];
    for (const job of jobs) {
      if (!(await websiteRequestRepository.markNotified(job.kind, job.id))) continue;
      try {
        await telegramService.send(cfg.chatId, job.text);
        sent++;
      } catch (err) {
        await websiteRequestRepository.unmarkNotified(job.kind, job.id);
        throw err;
      }
    }
    return { sent };
  }
}

export const websiteRequestNotifyService = new WebsiteRequestNotifyService();
