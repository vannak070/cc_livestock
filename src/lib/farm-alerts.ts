import { escapeHtml } from './alerts';
import { farmToday, todayNotRecorded } from './daily-feed';
import { scopeDataToFarm } from './farm-view';
import { longStayCattle, longStayMonths } from './long-stay';
import { prettyDay } from './sale-alerts';
import { saleReviewRows, saleWindowDays } from './sale-review';
import type { ERPLivestockData } from './types';

export type DigestData = Pick<ERPLivestockData, 'stock' | 'batches' | 'weightTracking' | 'settings'> & {
  feedProducts: NonNullable<ERPLivestockData['feedProducts']>;
  feedTransactions: NonNullable<ERPLivestockData['feedTransactions']>;
  cattleFollowUps: NonNullable<ERPLivestockData['cattleFollowUps']>;
};

/**
 * The Telegram messages, one per farm and kind, so each farm's people (or the
 * office looking at one farm) get exactly their own farm's news:
 *  - sale:     every morning while a batch is within its selling window or late
 *  - longstay: every morning while cattle have been on the farm a long time
 *  - evening:  5 pm reminder that today's feed is still not written down
 * Low feed is its own instant alert (low-feed-alerts.ts). Pure: the service
 * gathers the data and sends; this decides what to say.
 */

export type FarmAlertKind = 'sale' | 'longstay' | 'evening';

export interface FarmMessage {
  farm: string;
  kind: FarmAlertKind;
  /** The Telegram message (HTML subset; names are escaped). */
  message: string;
}

/** Hour of the farm day (0 to 23) after which the "today's feed" reminder goes out. */
export const EVENING_HOUR = 17;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortDay = (day: string) => prettyDay(day).replace(/ \d{4}$/, '');
const listIds = (ids: string[], max = 8) => ids.slice(0, max).map(escapeHtml).join(', ') + (ids.length > max ? ` and ${ids.length - max} more` : '');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Tuesday 6 Oct" for a YYYY-MM-DD day. */
const dayName = (day: string) => `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${shortDay(day)}`;

/** Farms that have something to look after: a name in Settings with an animal on it, or a batch. */
export function alertFarms(data: DigestData): string[] {
  const names = new Set<string>();
  for (const f of data.settings?.farms ?? []) names.add(f.name);
  const withAnimals = new Set([...data.stock.filter(c => c.status.toLowerCase() === 'active').map(c => c.location), ...data.batches.filter(b => b.status === 'Active').map(b => b.farmLocation ?? '')]);
  return [...names].filter(n => withAnimals.has(n)).sort((a, b) => a.localeCompare(b));
}

function farmData(data: DigestData, farm: string): ERPLivestockData {
  return scopeDataToFarm({ healthLogs: [], salesTracking: [], common: {}, ...data } as unknown as ERPLivestockData, farm, { includeFeed: true });
}

/** Every message looks the same: a bold title with the farm, the day, then short plain lines. */
function wrap(icon: string, title: string, farm: string, today: string, body: string[], appUrl?: string): string {
  const link = appUrl ? `\n\n<a href="${escapeHtml(appUrl)}">Open CC Livestock</a>` : '';
  return `${icon} <b>${title} · ${escapeHtml(farm)}</b>\n${dayName(today)}\n\n${body.join('\n')}${link}`;
}

/** The morning messages: selling reminder and long stay, for every farm that has something to say. */
export function buildMorningMessages(data: DigestData, now: Date, opts: { appUrl?: string } = {}): FarmMessage[] {
  const today = farmToday(now);
  const out: FarmMessage[] = [];
  for (const farm of alertFarms(data)) {
    const f = farmData(data, farm);
    const products = f.feedProducts ?? [];

    // Selling reminder: batches within the window or late; "Ready to sell" ones are already decided.
    const rows = saleReviewRows(f.batches, f.stock, f.weightTracking, products, now, saleWindowDays(data.settings)).filter(r => !r.decided);
    if (rows.length > 0) {
      const body = rows.map(r => {
        const when = r.daysRemaining < 0 ? `${plural(-r.daysRemaining, 'day', 'days')} late` : r.daysRemaining === 0 ? 'today' : `in ${plural(r.daysRemaining, 'day', 'days')}`;
        return `<b>${escapeHtml(r.batch.name)}</b>: ${plural(r.head, 'animal', 'animals')}, average ${r.avgWeight} kg\nSell by ${shortDay(r.batch.sellingTargetDate ?? '')} (${when})`;
      });
      out.push({ farm, kind: 'sale', message: wrap('💰', 'Selling reminder', farm, today, [...body.flatMap(b => [b, '']), 'Please decide: sell, or keep feeding.'], opts.appUrl) });
    }

    // Long time on the farm.
    const months = longStayMonths(data.settings);
    const long = longStayCattle(f.stock, months, f.cattleFollowUps ?? [], today);
    if (long.length > 0) {
      const none = long.filter(r => !r.next).length;
      const late = long.filter(r => r.overdue).length;
      const body = [
        `${plural(long.length, 'animal has', 'animals have')} been on the farm for ${months} months or more:`,
        listIds(long.map(r => `${r.cow.id} (${r.months} months)`)),
        ...(none > 0 || late > 0 ? [''] : []),
        ...(none > 0 ? [`• No next step written down: ${none}`] : []),
        ...(late > 0 ? [`• Next step is late: ${late}`] : []),
      ];
      out.push({ farm, kind: 'longstay', message: wrap('🐂', 'Long time on the farm', farm, today, body, opts.appUrl) });
    }
  }
  return out;
}

/** The 5 pm reminder, only for farms whose feed for today is still not written down. */
export function buildEveningMessages(data: DigestData, now: Date, opts: { appUrl?: string } = {}): FarmMessage[] {
  const today = farmToday(now);
  const out: FarmMessage[] = [];
  for (const farm of alertFarms(data)) {
    const f = farmData(data, farm);
    if (todayNotRecorded(farm, f.batches, f.stock, f.feedProducts ?? [], f.feedTransactions ?? [], today)) {
      out.push({ farm, kind: 'evening', message: wrap('⏰', 'Feed reminder', farm, today, ["Today's feed is not written down yet."], opts.appUrl) });
    }
  }
  return out;
}
