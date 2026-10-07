import type { BatchItem, FeedStockTransaction, HealthLogItem } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { addDays, feedDayStatus } from '../daily-feed';

/**
 * Standards badges on a member's profile, earned from real records and lost
 * when the records stop (SFD section 5). Thresholds are the owner's to
 * confirm; change them here only.
 */
export const FEED_BADGE_DAYS = 30;
export const FEED_BADGE_SHARE = 0.9;
export const WEIGH_BADGE_DAYS = 60;
export const VET_BADGE_DAYS = 183;

export type BadgeKey = 'feed' | 'weighing' | 'vet';

export interface BadgeInput {
  /** The farm's active cattle (already matched to the farm). */
  cattle: StockItem[];
  /** The farm's active batches. */
  batches: BatchItem[];
  weights: WeightRecord[];
  feedTransactions: FeedStockTransaction[];
  healthLogs: HealthLogItem[];
  /** YYYY-MM-DD, farm time. */
  today: string;
}

/** Feed recorded (fully or partly) on at least 90% of the last 30 days, counting yesterday back. */
export function feedBadge(input: Pick<BadgeInput, 'batches' | 'feedTransactions' | 'today'>): boolean {
  const ids = input.batches.map(b => b.id);
  if (ids.length === 0) return false;
  let recorded = 0;
  for (let i = 1; i <= FEED_BADGE_DAYS; i++) {
    const status = feedDayStatus(input.feedTransactions, ids, addDays(input.today, -i));
    if (status === 'recorded' || status === 'partly') recorded++;
  }
  return recorded >= Math.ceil(FEED_BADGE_DAYS * FEED_BADGE_SHARE);
}

/** Every active animal weighed (or bought) within the last 60 days. */
export function weighingBadge(input: Pick<BadgeInput, 'cattle' | 'weights' | 'today'>): boolean {
  if (input.cattle.length === 0) return false;
  const since = addDays(input.today, -WEIGH_BADGE_DAYS);
  const last = new Map<string, string>();
  for (const w of input.weights) {
    const day = (w.trackingDate ?? '').slice(0, 10);
    if (day && day > (last.get(w.cowId) ?? '')) last.set(w.cowId, day);
  }
  return input.cattle.every(c => {
    const day = last.get(c.id) ?? (c.purchaseDate ?? '').slice(0, 10);
    return !!day && day >= since;
  });
}

/** A vaccination, deworming or treatment record for the farm's cattle within the last 6 months. */
export function vetBadge(input: Pick<BadgeInput, 'cattle' | 'healthLogs' | 'today'>): boolean {
  const ids = new Set(input.cattle.map(c => c.id));
  const since = addDays(input.today, -VET_BADGE_DAYS);
  return input.healthLogs.some(l => ids.has(l.cowId) && l.type !== 'Disease' && (l.date ?? '').slice(0, 10) >= since);
}

export function badgesFor(input: BadgeInput): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (feedBadge(input)) out.push('feed');
  if (weighingBadge(input)) out.push('weighing');
  if (vetBadge(input)) out.push('vet');
  return out;
}
