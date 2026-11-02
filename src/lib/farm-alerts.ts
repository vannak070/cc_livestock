import { escapeHtml } from './alerts';
import { farmToday } from './daily-feed';
import { scopeDataToFarm } from './farm-view';
import { longStayCattle, longStayMonths } from './long-stay';
import { prettyDay } from './sale-alerts';
import { saleReviewRows, saleWindowDays } from './sale-review';
import type { ERPLivestockData } from './types';
import type { Task } from './ops-program';
import { taskViews } from './ops-view';
import { HELD_ALERT_DAYS, heldLots, type Holding } from './camcow-stock';
import type { SalesRecord } from './xlsx-parser';

export type DigestData = Pick<ERPLivestockData, 'stock' | 'batches' | 'weightTracking' | 'settings'> & {
  feedProducts: NonNullable<ERPLivestockData['feedProducts']>;
  feedTransactions: NonNullable<ERPLivestockData['feedTransactions']>;
  cattleFollowUps: NonNullable<ERPLivestockData['cattleFollowUps']>;
  /** The farm programs and their tasks, with the sales the task evidence is matched against. */
  /** The cattle CC Livestock holds after collecting them (CamCow stock). */
  camcow?: Holding[];
  ops?: { programs: { id: string; farm: string; status: string }[]; tasks: Task[]; sales: SalesRecord[] };
};

/**
 * The Telegram messages, one per farm and kind, so each farm's people (or the
 * office looking at one farm) get exactly their own farm's news:
 *  - sale:     every morning while a batch is within its selling window or late
 *  - longstay: every morning while cattle have been on the farm a long time
 *  - tasks:    every morning while a farm's task (sell cattle to the farm, buy back) is late
 *  - camcow:   every morning while cattle have been in CamCow stock longer than HELD_ALERT_DAYS (one message for the whole stock site)
 * Low feed is its own instant alert (low-feed-alerts.ts). Pure: the service
 * gathers the data and sends; this decides what to say.
 */

export type FarmAlertKind = 'sale' | 'longstay' | 'tasks' | 'camcow';

export interface FarmMessage {
  farm: string;
  kind: FarmAlertKind;
  /** The Telegram message (HTML subset; names are escaped). */
  message: string;
}

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
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
        const sexes = [r.males > 0 ? `${r.males} male` : '', r.females > 0 ? `${r.females} female` : ''].filter(Boolean).join(', ');
        const weight = r.minWeight === null || r.maxWeight === null ? `Average weight: ${r.avgWeight} kg` : `Weight: ${r.minWeight} to ${r.maxWeight} kg (average ${r.avgWeight} kg)`;
        const price = r.pricePerKg === null ? 'Selling price: not set yet' : `Selling price: ${riel(r.pricePerKg)} per kg${r.expectedValue ? ` (about ${riel(r.expectedValue)} in total)` : ''}`;
        return [`<b>${escapeHtml(r.batch.name)}</b>: ${plural(r.head, 'animal', 'animals')}${sexes ? ` (${sexes})` : ''}`, weight, price, `Sell by ${shortDay(r.batch.sellingTargetDate ?? '')} (${when})`].join('\n');
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
  out.push(...lateTaskMessages(data, today, opts));
  out.push(...camcowHeldMessages(data.camcow ?? [], today, opts));
  return out;
}

/** CamCow's own stock: one message while cattle have been held longer than HELD_ALERT_DAYS without being sold. */
export function camcowHeldMessages(holdings: Holding[], today: string, opts: { appUrl?: string } = {}): FarmMessage[] {
  const late = heldLots(holdings, today).filter(l => l.daysHeld > HELD_ALERT_DAYS);
  if (late.length === 0) return [];
  const head = late.reduce((a, l) => a + l.head, 0);
  const lines = late.slice(0, 8).map(l => `• ${escapeHtml(l.farm)}: ${plural(l.head, 'animal', 'animals')}, ${plural(l.daysHeld, 'day', 'days')} in stock (collected ${shortDay(l.collectedOn)})`);
  const body = [
    `${plural(head, 'animal has', 'animals have')} been in CamCow stock for more than ${HELD_ALERT_DAYS} days:`,
    ...lines,
    ...(late.length > 8 ? [`and ${late.length - 8} more lots`] : []),
    '',
    'Please sell them, or write down why they are kept.',
  ];
  return [{ farm: 'CamCow stock', kind: 'camcow', message: wrap('🏬', 'Cattle held too long', 'CamCow stock', today, body, opts.appUrl) }];
}

/** What a task asks for, in one plain line. */
function taskLine(t: Task, batchName: string | undefined): string {
  const head = t.plannedHead ?? 0;
  return t.kind === 'sell_to_farm'
    ? `Sell ${head} new cattle to the farm`
    : `Collect ${head} finished cattle${batchName ? ` (${escapeHtml(batchName)})` : ''}`;
}

/** One message per farm that has a late task (an Active program only); the status comes from the same rules as the Tasks screen. */
export function lateTaskMessages(data: DigestData, today: string, opts: { appUrl?: string } = {}): FarmMessage[] {
  if (!data.ops) return [];
  const farmOfProgram = new Map(data.ops.programs.filter(p => p.status === 'Active').map(p => [p.id, p.farm]));
  const late = taskViews(data.ops.tasks, farmOfProgram, data.stock, data.ops.sales, today).filter(v => v.state.status === 'late');
  const batchName = new Map(data.batches.map(b => [b.id, b.name]));
  const farms = [...new Set(late.map(v => farmOfProgram.get(v.task.programId) ?? ''))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return farms.map(farm => {
    const mine = late.filter(v => farmOfProgram.get(v.task.programId) === farm).sort((a, b) => b.state.daysLate - a.state.daysLate);
    const lines = mine.slice(0, 6).map(v => `• ${taskLine(v.task, v.task.batchId ? batchName.get(v.task.batchId) : undefined)}: ${plural(v.state.daysLate, 'day', 'days')} late (due ${shortDay(v.task.dueDate)})`);
    const body = [
      `${plural(mine.length, 'task is', 'tasks are')} late:`,
      ...lines,
      ...(mine.length > 6 ? [`and ${mine.length - 6} more`] : []),
      '',
      'Please do it, or postpone it and say why.',
    ];
    return { farm, kind: 'tasks' as const, message: wrap('📋', 'Late farm tasks', farm, today, body, opts.appUrl) };
  });
}
