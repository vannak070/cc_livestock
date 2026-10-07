/**
 * Rounding rules: exact weights, counts and dates never leave CC Livestock.
 * Each rule turns a real number into the coarse value the public may see
 * (SFD section 5). Pure and browser-safe.
 */

export const WEIGHT_CLASSES = ['Under 250 kg', '250–300 kg', '300–350 kg', '350–400 kg', '400 kg+'] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number];

/** The class an average weight falls in. */
export function weightClass(avgKg: number): WeightClass {
  if (avgKg < 250) return 'Under 250 kg';
  if (avgKg < 300) return '250–300 kg';
  if (avgKg < 350) return '300–350 kg';
  if (avgKg < 400) return '350–400 kg';
  return '400 kg+';
}

export const HEAD_COUNTS = ['Under 10', '10+', '20+', '50+'] as const;
export type HeadCount = (typeof HEAD_COUNTS)[number];

/** How many animals a listing shows: never the exact number. */
export function headCountLabel(n: number): HeadCount {
  if (n < 10) return 'Under 10';
  if (n < 20) return '10+';
  if (n < 50) return '20+';
  return '50+';
}

export const FARM_SIZES = ['Under 20 head', '20–50 head', '50–100 head', '100+ head'] as const;
export type FarmSize = (typeof FARM_SIZES)[number];

/** A member farm's size, from its active cattle. */
export function farmSizeRange(activeCattle: number): FarmSize {
  if (activeCattle < 20) return 'Under 20 head';
  if (activeCattle < 50) return '20–50 head';
  if (activeCattle < 100) return '50–100 head';
  return '100+ head';
}

/** Rounded down to a step and shown with "+", e.g. 27 by 5 -> "25+". Below one step: the number itself. */
export function roundedTotal(n: number, step: number): string {
  if (n < step) return String(Math.max(0, Math.floor(n)));
  return `${(Math.floor(n / step) * step).toLocaleString('en-US')}+`;
}

/** A share as a whole percentage rounded to 5; null when there is nothing to count. */
export function percentTo5(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round(((part / whole) * 100) / 5) * 5;
}

/**
 * The map pin the public sees. Without consent for the exact place it is
 * rounded to 0.1 degree (about 11 km), so the farm cannot be found from it.
 */
export function publicPin(lat: number, lng: number, exactAllowed: boolean): { lat: number; lng: number } {
  if (exactAllowed) return { lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 };
  return { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
}

/** A short, stable code made from an internal id, so internal ids never appear on the site. */
export function publicCode(internalId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < internalId.length; i++) {
    h ^= internalId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(6, '0').slice(0, 6);
}

/** A readable web address for a farm: Latin words from its public name plus a short code. */
export function farmSlug(publicName: string, farmId: string): string {
  const words = publicName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${words || 'farm'}-${publicCode(farmId)}`;
}
