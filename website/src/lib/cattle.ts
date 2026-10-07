import type { PublicFarm, PublicListing } from './snapshot/types';

/** Cattle for sale are shown by farm: these helpers group the snapshot's entries and write their weight ranges. */

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';
export const khDigits = (text: string): string => text.replace(/\d/g, d => KHMER_DIGITS[Number(d)]);

export interface RangeWords {
  between: string; // "{from}–{to} kg"
  under: string;   // "Under {to} kg"
  over: string;    // "{from} kg+"
  any: string;     // "Any size"
}

/** "300–400 kg", "Under 250 kg", "400 kg+" or "Any size", in Khmer digits for Khmer. */
export function weightRangeText(from: number | null, to: number | null, words: RangeWords, lang: 'km' | 'en' = 'en'): string {
  const put = (template: string) => template.replace('{from}', String(from)).replace('{to}', String(to));
  const text = from == null && to == null ? words.any : from == null ? put(words.under) : to == null ? put(words.over) : put(words.between);
  return lang === 'km' ? khDigits(text) : text;
}

export interface FarmCattle {
  farm: PublicFarm;
  /** The code the price form carries for this farm. */
  listingId: string;
  /** "now" first, then "soon". */
  windows: PublicListing[];
}

const ORDER = { now: 0, soon: 1 } as const;

/** One entry per farm that has cattle for sale: farms with cattle available now first, then by province and name. */
export function groupByFarm(listings: PublicListing[], farms: PublicFarm[]): FarmCattle[] {
  const bySlug = new Map(farms.map(f => [f.slug, f]));
  const groups = new Map<string, FarmCattle>();
  for (const l of listings) {
    const farm = bySlug.get(l.farmSlug);
    if (!farm) continue;
    const g = groups.get(l.farmSlug) ?? { farm, listingId: l.listingId, windows: [] };
    g.windows.push(l);
    groups.set(l.farmSlug, g);
  }
  return [...groups.values()]
    .map(g => ({ ...g, windows: [...g.windows].sort((a, b) => ORDER[a.availability] - ORDER[b.availability]) }))
    .sort((a, b) => ORDER[a.windows[0].availability] - ORDER[b.windows[0].availability] || a.farm.province.localeCompare(b.farm.province) || a.farm.publicName.localeCompare(b.farm.publicName));
}
