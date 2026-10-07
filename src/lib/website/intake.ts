import { PROVINCES } from './places';

/**
 * What the public website may send to CC Livestock (applications, price
 * inquiries, visit counts), checked again here because the website is on the
 * open internet and CC Livestock must not trust it. These rules mirror the
 * website's own forms (website/src/lib/forms/validate.ts and
 * website/src/lib/visits.ts); intake.test.ts compares the two so they cannot
 * drift apart. Pure: no database, no network.
 */

export const WEIGHT_CLASSES = ['Under 250 kg', '250–300 kg', '300–350 kg', '350–400 kg', '400 kg+'];
export const BUYER_TYPES = ['trader', 'slaughterhouse', 'investor', 'other'];
export const EVENT_KINDS = ['view', 'join', 'call', 'telegram', 'price', 'notify'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type Language = 'km' | 'en';

export interface ApplicationIn {
  name: string;
  phone: string;
  province: string;
  district: string;
  landM2: number | null;
  cattleNow: number | null;
  hasPens: boolean | null;
  consent: boolean;
  language: Language;
}

export interface InquiryIn {
  /** 'price' = Ask for a price; 'notify' = tell me when cattle are available. */
  kind: 'price' | 'notify';
  name: string;
  phone: string;
  buyerType: string;
  quantity: number | null;
  weightClass: string;
  listingId: string | null;
  message: string;
  language: Language;
}

export interface EventIn {
  kind: EventKind;
  path: string;
  lang: Language;
  referrer: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; field: string };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const whole = (v: unknown, max: number): number | null | undefined => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[ ,]/g, ''));
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
};
const lang = (v: unknown): Language => (v === 'en' ? 'en' : 'km');

/** Cambodian phone numbers (8-10 digits, may start with +855) or a Telegram @name. */
export const isContact = (v: string) => /^(\+?855|0)?[1-9]\d{7,8}$/.test(v.replace(/[\s-]/g, '')) || /^@[A-Za-z0-9_]{5,32}$/.test(v);

export function checkApplicationIn(raw: Record<string, unknown>): Checked<ApplicationIn> {
  const name = text(raw.name, 80);
  const phone = text(raw.phone, 40);
  const province = text(raw.province, 40);
  const district = text(raw.district, 60);
  const landM2 = whole(raw.landM2, 100_000_000);
  const cattleNow = whole(raw.cattleNow, 100_000);
  if (name.length < 2) return { ok: false, field: 'name' };
  if (!isContact(phone)) return { ok: false, field: 'phone' };
  if (!PROVINCES.some(p => p.key === province)) return { ok: false, field: 'province' };
  if (landM2 === undefined) return { ok: false, field: 'landM2' };
  if (cattleNow === undefined) return { ok: false, field: 'cattleNow' };
  if (raw.consent !== true) return { ok: false, field: 'consent' };
  const hasPens = raw.hasPens === true ? true : raw.hasPens === false ? false : null;
  return { ok: true, value: { name, phone, province, district, landM2, cattleNow, hasPens, consent: true, language: lang(raw.language) } };
}

export function checkInquiryIn(raw: Record<string, unknown>): Checked<InquiryIn> {
  const name = text(raw.name, 80);
  const phone = text(raw.phone, 40);
  const buyerType = text(raw.buyerType, 30);
  const quantity = whole(raw.quantity, 10_000);
  const weightClass = text(raw.weightClass, 30);
  const listingId = text(raw.listingId, 20);
  if (name.length < 2) return { ok: false, field: 'name' };
  if (!isContact(phone)) return { ok: false, field: 'phone' };
  if (buyerType && !BUYER_TYPES.includes(buyerType)) return { ok: false, field: 'buyerType' };
  if (quantity === undefined) return { ok: false, field: 'quantity' };
  if (weightClass && !WEIGHT_CLASSES.includes(weightClass)) return { ok: false, field: 'weightClass' };
  if (listingId && !/^l-[a-z0-9]{6}$/.test(listingId)) return { ok: false, field: 'listingId' };
  const message = typeof raw.message === 'string' ? raw.message.trim().slice(0, 1000) : '';
  const kind = raw.kind === 'notify' ? 'notify' : 'price';
  return { ok: true, value: { kind, name, phone, buyerType, quantity, weightClass, listingId: kind === 'notify' ? null : listingId || null, message, language: lang(raw.language) } };
}

/** "/en/members/sokha-farm?x=1" gives lang en, path "/members/sokha-farm". Anything odd gives null. */
export function cleanPath(raw: unknown): { lang: Language; path: string } | null {
  if (typeof raw !== 'string') return null;
  const bare = raw.split(/[?#]/)[0].toLowerCase();
  const m = /^\/(km|en)(\/[a-z0-9\-/]*)?$/.exec(bare);
  if (!m) return null;
  const path = (m[2] ?? '/').replace(/\/+$/, '') || '/';
  return path.length <= 100 ? { lang: m[1] as Language, path } : null;
}

/** The other site's name only ("www.facebook.com" gives "facebook.com"); empty for this site or nothing. */
export function referrerHost(raw: unknown, ownHost: string): string {
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    return host && host !== ownHost.replace(/^www\./, '') && /^[a-z0-9.-]{1,100}$/.test(host) ? host : '';
  } catch {
    return '';
  }
}

/**
 * A visit count the website sends. The website has already split the address
 * into language + page ({ lang: 'en', path: '/members' }); a raw address
 * ('/en/members') is accepted too. The referrer is already a host name, so
 * only its shape is checked here.
 */
export function checkEventIn(raw: Record<string, unknown>): EventIn | null {
  if (!EVENT_KINDS.includes(raw.kind as EventKind)) return null;
  const where = cleanPath(raw.path) ?? (raw.lang === 'en' || raw.lang === 'km' ? cleanPath(`/${raw.lang}${typeof raw.path === 'string' && raw.path !== '/' ? raw.path : ''}`) : null);
  if (!where) return null;
  const referrer = raw.kind === 'view' && typeof raw.referrer === 'string' && /^[a-z0-9.-]{1,100}$/.test(raw.referrer) ? raw.referrer : '';
  return { kind: raw.kind as EventKind, ...where, referrer };
}

export type Device = 'phone' | 'computer';
export const deviceOf = (v: unknown): Device => (v === 'phone' ? 'phone' : 'computer');
