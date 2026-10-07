import type { WebsitePublishStatus } from '../../types/website.types';
import { escapeHtml } from '../alerts';

/**
 * Is the public website being kept up to date? The snapshot is published
 * after every office change and every 15 minutes; each try is recorded in
 * `MasterSetup.websiteStatus` (written by the server only). The Website page
 * shows a warning when publishing fails or has stopped, and the CamCow
 * Telegram group gets one message when it starts failing and one when it
 * works again. Pure, so the page and the server agree.
 */

export type { WebsitePublishStatus };

/** The scheduler publishes every 15 minutes, so 45 minutes without a good publish means it has stopped. */
export const STALE_AFTER_MINUTES = 45;

export type PublishHealth =
  | { state: 'ok'; lastOkAt: string }
  | { state: 'never' }
  | { state: 'failing'; since: string; error: string; lastOkAt?: string }
  | { state: 'stale'; lastOkAt: string };

export function publishHealth(status: WebsitePublishStatus | undefined, now: Date): PublishHealth {
  const s = status ?? {};
  if (s.failingSince) return { state: 'failing', since: s.failingSince, error: s.lastError || 'Unknown error', ...(s.lastOkAt ? { lastOkAt: s.lastOkAt } : {}) };
  if (!s.lastOkAt) return { state: 'never' };
  const minutes = (now.getTime() - new Date(s.lastOkAt).getTime()) / 60_000;
  return minutes > STALE_AFTER_MINUTES ? { state: 'stale', lastOkAt: s.lastOkAt } : { state: 'ok', lastOkAt: s.lastOkAt };
}

/** The status after a publish that worked. */
export const afterSuccess = (s: WebsitePublishStatus | undefined, at: string): WebsitePublishStatus => ({ ...s, lastOkAt: at, failingSince: null, lastError: null });

/** The status after a publish that failed (the run of failures keeps its first time). */
export const afterFailure = (s: WebsitePublishStatus | undefined, at: string, error: string): WebsitePublishStatus => ({
  ...s,
  lastFailedAt: at,
  lastError: error.slice(0, 300),
  failingSince: s?.failingSince || at,
});

/** What to tell the group now: 'failed' once per run of failures, 'recovered' once when it works again. */
export function publishAlertDue(s: WebsitePublishStatus | undefined): 'failed' | 'recovered' | null {
  if (!s) return null;
  if (s.failingSince && !s.failureAlertedAt) return 'failed';
  if (!s.failingSince && s.failureAlertedAt) return 'recovered';
  return null;
}

const shortTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export function buildPublishFailedMessage(s: WebsitePublishStatus): string {
  return [
    '⚠️ <b>Website update failed</b>',
    '',
    `The public website could not be updated since ${escapeHtml(shortTime(s.failingSince ?? s.lastFailedAt ?? new Date().toISOString()))}.`,
    s.lastOkAt ? `It still shows the last good version, from ${escapeHtml(shortTime(s.lastOkAt))}.` : 'Nothing has been published yet.',
    `Reason: ${escapeHtml((s.lastError ?? 'unknown').slice(0, 200))}`,
    '',
    'Please ask an Admin to open the Website page.',
  ].join('\n');
}

export const buildPublishRecoveredMessage = (): string => '✅ <b>Website updates are working again</b>\n\nThe public website is up to date.';

/** Website requests (applications, inquiries and their photos) are kept for 24 months, then deleted. */
export const REQUEST_KEEP_MONTHS = 24;
