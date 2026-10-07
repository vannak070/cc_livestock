/**
 * Visitor counts for the office (CC Livestock's Website page → Visitors).
 * Privacy first: no cookies, no addresses, no browser fingerprint. Each page
 * view or button press is one row: what happened, which page (without any
 * ?query), the language, phone or computer, and the other site a visitor came
 * from (its name only). People who ask browsers not to be tracked are not
 * counted. Shared by the browser (what to send) and the server (what to accept).
 */
export const EVENT_KINDS = ['view', 'join', 'call', 'telegram', 'price', 'notify'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface EventIn {
  kind: EventKind;
  path: string;
  lang: 'km' | 'en';
  referrer: string;
}

/** "/en/members/sokha-farm?x=1" → lang en, path "/members/sokha-farm". Anything odd → null. */
export function cleanPath(raw: unknown): { lang: 'km' | 'en'; path: string } | null {
  if (typeof raw !== 'string') return null;
  const bare = raw.split(/[?#]/)[0].toLowerCase();
  const m = /^\/(km|en)(\/[a-z0-9\-/]*)?$/.exec(bare);
  if (!m) return null;
  const path = (m[2] ?? '/').replace(/\/+$/, '') || '/';
  return path.length <= 100 ? { lang: m[1] as 'km' | 'en', path } : null;
}

/** The other site's name only ("www.facebook.com" → "facebook.com"); empty for this site or nothing. */
export function referrerHost(raw: unknown, ownHost: string): string {
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    return host && host !== ownHost.replace(/^www\./, '') && /^[a-z0-9.-]{1,100}$/.test(host) ? host : '';
  } catch {
    return '';
  }
}

export function checkEvent(raw: Record<string, unknown>, ownHost: string): EventIn | null {
  if (!EVENT_KINDS.includes(raw.kind as EventKind)) return null;
  const where = cleanPath(raw.path);
  if (!where) return null;
  return { kind: raw.kind as EventKind, ...where, referrer: raw.kind === 'view' ? referrerHost(raw.referrer, ownHost) : '' };
}

export const isPhone = (userAgent: string | null): boolean => /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent ?? '');

export const isBot = (userAgent: string | null): boolean => !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i.test(userAgent);
