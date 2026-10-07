import { PROVINCES } from '../places';

/**
 * Checks for the two public forms. Pure, so the same rules run in the browser
 * (instant feedback) and on the server (the real check). Returns cleaned
 * values or the name of the first field that is wrong.
 */

export const WEIGHT_CLASSES = ['Under 250 kg', '250–300 kg', '300–350 kg', '350–400 kg', '400 kg+'];
export const BUYER_TYPES = ['trader', 'slaughterhouse', 'investor', 'other'];

export interface ApplicationIn {
  name: string;
  phone: string;
  province: string;
  district: string;
  landM2: number | null;
  cattleNow: number | null;
  hasPens: boolean | null;
  consent: boolean;
  language: 'km' | 'en';
}

export interface InquiryIn {
  name: string;
  phone: string;
  buyerType: string;
  quantity: number | null;
  weightClass: string;
  listingId: string | null;
  message: string;
  language: 'km' | 'en';
}

export type Checked<T> = { ok: true; value: T } | { ok: false; field: string };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const whole = (v: unknown, max: number): number | null | undefined => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[ ,]/g, ''));
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
};
/** Cambodian phone numbers (8-10 digits, may start with +855) or a Telegram @name. */
export const isContact = (v: string) => /^(\+?855|0)?[1-9]\d{7,8}$/.test(v.replace(/[\s-]/g, '')) || /^@[A-Za-z0-9_]{5,32}$/.test(v);
const lang = (v: unknown): 'km' | 'en' => (v === 'en' ? 'en' : 'km');

export function checkApplication(raw: Record<string, unknown>): Checked<ApplicationIn> {
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

export function checkInquiry(raw: Record<string, unknown>): Checked<InquiryIn> {
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
  return { ok: true, value: { name, phone, buyerType, quantity, weightClass, listingId: listingId || null, message, language: lang(raw.language) } };
}

/** A filled hidden field ("website") means a robot filled the form. */
export const isRobot = (raw: Record<string, unknown>) => typeof raw.website === 'string' && raw.website.trim() !== '';
