import { escapeHtml } from './alerts';
import { feedStockLevels } from './attention';
import { farmsToRecord } from './daily-feed';
import { scopeDataToFarm } from './farm-view';
import type { ERPLivestockData } from './types';

/**
 * Instant low-feed alerts: one Telegram message the moment a farm's feed that
 * is being fed drops to or below its minimum, once per farm and feed until the
 * farm restocks above the minimum (then it is armed again). Pure: the service
 * gathers the data and the log, this decides what to say.
 *
 * Stock is counted farm by farm, as a farm's own Feed page does, so one farm
 * running low is not hidden by another's stock. Only feeds that are in use
 * count: a feed nobody is feeding is not urgent (the morning check-up still
 * mentions it).
 */

export type LowFeedData = Pick<ERPLivestockData, 'stock' | 'batches'> & {
  settings?: Pick<NonNullable<ERPLivestockData['settings']>, 'farms'>;
  feedProducts: NonNullable<ERPLivestockData['feedProducts']>;
  feedTransactions: NonNullable<ERPLivestockData['feedTransactions']>;
};

export interface LowFeed {
  farm: string;
  productId: string;
  productName: string;
  bags: number;
  thresholdBags: number;
  /** Whole days left at the current ration; null when nothing is being used. */
  daysLeft: number | null;
}

/** Every feed in use, per farm, that is at or below its minimum right now. */
export function lowFeedNow(data: LowFeedData): LowFeed[] {
  const farms = [...new Set([...farmsToRecord(data.batches), ...(data.settings?.farms ?? []).map(f => f.name)])].sort();
  const out: LowFeed[] = [];
  for (const farm of farms) {
    const scoped = scopeDataToFarm({ weightTracking: [], healthLogs: [], salesTracking: [], common: {}, ...data } as unknown as ERPLivestockData, farm, { includeFeed: true });
    for (const l of feedStockLevels(scoped)) {
      if (!l.isLow || !(l.dailyUseKg > 0)) continue;
      out.push({ farm, productId: l.productId, productName: l.productName, bags: Math.round(l.bags), thresholdBags: Math.round(l.thresholdBags), daysLeft: l.daysLeft });
    }
  }
  return out;
}

export interface SentLowFeed { farm: string; productId: string }

const key = (farm: string, productId: string) => `${farm.trim().toLowerCase()}\u0000${productId}`;

/**
 * What to announce now (low and not announced yet) and what to re-arm (announced
 * before, no longer low, so a new drop sends a new alert).
 */
export function planLowFeedAlerts(low: LowFeed[], sent: SentLowFeed[]): { announce: LowFeed[]; rearm: SentLowFeed[] } {
  const lowKeys = new Set(low.map(l => key(l.farm, l.productId)));
  const sentKeys = new Set(sent.map(s => key(s.farm, s.productId)));
  return {
    announce: low.filter(l => !sentKeys.has(key(l.farm, l.productId))),
    rearm: sent.filter(s => !lowKeys.has(key(s.farm, s.productId))),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The Telegram message for one low feed (HTML subset; names are escaped). Plain words, red when it is nearly gone. */
export function buildLowFeedAlert(l: LowFeed, options: { appUrl?: string } = {}): string {
  const link = options.appUrl ? `\n\n<a href="${escapeHtml(options.appUrl)}">Open CC Livestock</a>` : '';
  const days = l.daysLeft === null || l.daysLeft <= 0 ? '' : ` (about ${plural(l.daysLeft, 'day', 'days')})`;
  const icon = l.daysLeft !== null && l.daysLeft <= 3 ? '🔴' : '⚠️';
  return `${icon} <b>Low feed · ${escapeHtml(l.farm)}</b>\n\n${escapeHtml(l.productName)}: ${plural(l.bags, 'bag', 'bags')} left${days}.\nThe minimum is ${l.thresholdBags} bags. Please order more.${link}`;
}
