import { farmToday } from './daily-feed';
import { escapeHtml } from './alerts';
import { feedStockLevels, sickCattle, weighSchedules, WEIGH_INTERVAL_DAYS } from './attention';
import { farmsToRecord, missedFeedDays, todayNotRecorded, unlinkedRationFeeds } from './daily-feed';
import { longStayCattle, longStayMonths } from './long-stay';
import { prettyDay } from './sale-alerts';
import { scopeDataToFarm } from './farm-view';
import type { ERPLivestockData } from './types';

/**
 * The daily Telegram check-up: the same things the Today screen flags (missed
 * feed days, weighing, long-stay cattle, sick animals, low feed stock), minus
 * the sale review, which has its own alerts. Pure: the service gathers the
 * data, this decides what to say.
 */

export type DigestKind = 'morning' | 'evening';

/** Hour of the farm day (0 to 23) after which the "today's feed" reminder goes out. */
export const EVENING_HOUR = 17;

export type DigestData = Pick<ERPLivestockData, 'stock' | 'batches' | 'weightTracking' | 'settings'> & {
  feedProducts: NonNullable<ERPLivestockData['feedProducts']>;
  feedTransactions: NonNullable<ERPLivestockData['feedTransactions']>;
  cattleFollowUps: NonNullable<ERPLivestockData['cattleFollowUps']>;
};

export interface DigestLine { icon: '🔴' | '🟠'; text: string }

export interface Digest {
  lines: DigestLine[];
  /** The Telegram message, or null when there is nothing to report. */
  message: string | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortDay = (day: string) => prettyDay(day).replace(/ \d{4}$/, '');
const listIds = (ids: string[], max = 5) => ids.slice(0, max).map(escapeHtml).join(', ') + (ids.length > max ? ` +${ids.length - max}` : '');

/** Cattle per farm, for counting by place. */
function byFarm<T>(items: T[], farmOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const farm = farmOf(item) || '—';
    map.set(farm, [...(map.get(farm) ?? []), item]);
  }
  return map;
}

const farmCounts = (groups: Map<string, unknown[]>) =>
  [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([farm, items]) => `${escapeHtml(farm)} ${items.length}`).join(', ');

/** What needs saying today. The evening kind is only the "today's feed is not written down" reminder. */
export function buildDailyDigest(data: DigestData, now: Date, kind: DigestKind, opts: { appUrl?: string } = {}): Digest {
  const today = farmToday(now);
  const lines: DigestLine[] = [];
  const { batches, stock, feedProducts: products, feedTransactions: txs } = data;
  const farms = farmsToRecord(batches);

  if (kind === 'morning') {
    for (const farm of farms) {
      const missed = missedFeedDays(farm, batches, stock, products, txs, today);
      if (missed.length > 0) {
        const shown = missed.slice(-4).map(shortDay).join(', ');
        lines.push({ icon: '🔴', text: `<b>${escapeHtml(farm)}</b>: feed not written down for ${plural(missed.length, 'day', 'days')} (${missed.length > 4 ? '…, ' : ''}${shown}). Stock is only taken when the day is recorded.` });
      }
    }
    const sick = sickCattle(stock);
    if (sick.length > 0) {
      lines.push({ icon: '🔴', text: `${plural(sick.length, 'animal is', 'animals are')} unwell: ${listIds(sick.map(c => c.id))}${new Set(sick.map(c => c.location)).size > 1 ? ` (${farmCounts(byFarm(sick, c => c.location))})` : ''}` });
    }
    // Same rule as the Feed page: a feed is low at or below its own minimum (bags or kg).
    // Stock is counted farm by farm, as a farm's own screen does, so one farm running low is not hidden by another's stock.
    const feedFarms = [...new Set([...farms, ...(data.settings?.farms ?? []).map(f => f.name)])].sort();
    for (const farm of feedFarms) {
      const scoped = scopeDataToFarm({ healthLogs: [], salesTracking: [], common: {}, ...data } as unknown as ERPLivestockData, farm, { includeFeed: true });
      const moved = new Set((scoped.feedTransactions ?? []).map(t => t.productId));
      const low = feedStockLevels(scoped).filter(l => l.isLow);
      const inUse = low.filter(l => l.dailyUseKg > 0).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
      for (const l of inUse.slice(0, 4)) {
        const left = l.daysLeft === null || l.daysLeft <= 0 ? `only ${Math.round(l.bags)} bags left` : `about ${plural(l.daysLeft, 'day', 'days')} left (${Math.round(l.bags)} bags)`;
        lines.push({ icon: l.daysLeft !== null && l.daysLeft <= 3 ? '🔴' : '🟠', text: `<b>${escapeHtml(farm)}</b>: feed running low, <b>${escapeHtml(l.productName)}</b>, ${left}. Minimum is ${Math.round(l.thresholdBags)} bags.` });
      }
      // Feeds the farm has handled but is not feeding now; a feed it never had is not "low".
      const idle = low.filter(l => l.dailyUseKg === 0 && moved.has(l.productId));
      if (idle.length > 0) {
        lines.push({ icon: '🟠', text: `<b>${escapeHtml(farm)}</b>: below the minimum but not being fed now: ${idle.slice(0, 5).map(l => `${escapeHtml(l.productName)} (${Math.round(l.bags)} bags)`).join(', ')}${idle.length > 5 ? ` +${idle.length - 5}` : ''}` });
      }
    }
    for (const u of unlinkedRationFeeds(batches, products)) {
      lines.push({ icon: '🟠', text: `Batch ${escapeHtml(u.batch.name)}: feed plan has feeds not in the feed list (${u.names.map(escapeHtml).join(', ')}), so it cannot be recorded` });
    }
    const overdue = weighSchedules(data, WEIGH_INTERVAL_DAYS, now).filter(s => s.status === 'overdue');
    if (overdue.length > 0) {
      const farmOf = new Map(stock.map(c => [c.id, c.location]));
      lines.push({ icon: '🟠', text: `${plural(overdue.length, 'animal is', 'animals are')} overdue for weighing (every ${WEIGH_INTERVAL_DAYS} days): ${farmCounts(byFarm(overdue, s => farmOf.get(s.cowId) ?? ''))}` });
    }
    const months = longStayMonths(data.settings);
    const long = longStayCattle(stock, months, data.cattleFollowUps, today);
    if (long.length > 0) {
      const none = long.filter(r => !r.next).length;
      const late = long.filter(r => r.overdue).length;
      const extra = [none > 0 ? `${none} with no next action` : '', late > 0 ? `${late} next ${late === 1 ? 'action is' : 'actions are'} late` : ''].filter(Boolean).join(', ');
      lines.push({ icon: '🟠', text: `${plural(long.length, 'animal has', 'animals have')} been on the farm over ${months} months: ${farmCounts(byFarm(long, r => r.cow.location))}${extra ? `. ${extra}` : ''}` });
    }
  } else {
    for (const farm of farms) {
      if (todayNotRecorded(farm, batches, stock, products, txs, today)) {
        lines.push({ icon: '🟠', text: `<b>${escapeHtml(farm)}</b>: today's feed is not written down yet` });
      }
    }
  }

  if (lines.length === 0) return { lines, message: null };
  const head = kind === 'morning' ? '🐄 <b>CC Livestock · Daily check</b>' : '🐄 <b>CC Livestock · Feed reminder</b>';
  const link = opts.appUrl ? `\n\n<a href="${escapeHtml(opts.appUrl)}">Open CC Livestock</a>` : '';
  const sale = kind === 'morning' ? '\n\n<i>Batches near their selling date are sent as separate alerts.</i>' : '';
  return { lines, message: `${head}\n${prettyDay(today)}\n\n${lines.map(l => `${l.icon} ${l.text}`).join('\n')}${sale}${link}` };
}
