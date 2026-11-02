import type { PublicSnapshot } from './types';

/**
 * Cattle availability is only true while CC Livestock keeps publishing (every 15 minutes while its API runs).
 * When the last snapshot is older than this, the site stops showing which cattle are available: a buyer could
 * otherwise ask for cattle that were sold days ago. Farms, photos and totals stay. Set CAMCOW_STALE_HOURS to change it.
 */
export const STALE_AFTER_HOURS_DEFAULT = 48;

export function staleAfterHours(): number {
  const n = Number(process.env.CAMCOW_STALE_HOURS);
  return Number.isFinite(n) && n > 0 ? n : STALE_AFTER_HOURS_DEFAULT;
}

/** Minutes since CC Livestock built the snapshot, or null when it has no date (an empty site). */
export function snapshotAgeMinutes(s: Pick<PublicSnapshot, 'builtAt'>, now = Date.now()): number | null {
  if (!s.builtAt) return null;
  const t = Date.parse(s.builtAt);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 60_000));
}

/** The snapshot as the site may show it: when too old, no cattle listings and no "has cattle" marks, and `stale: true`. */
export function guardStale(s: PublicSnapshot, now = Date.now(), hours = staleAfterHours()): PublicSnapshot {
  const age = snapshotAgeMinutes(s, now);
  if (age === null || age <= hours * 60) return s.stale ? { ...s, stale: false } : s;
  return { ...s, stale: true, cattle: [], farms: s.farms.map(f => ({ ...f, hasCattleAvailable: false })) };
}
