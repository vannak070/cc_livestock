import { addDays, farmToday, FARM_TIME_ZONE } from './daily-feed';
import { escapeHtml } from './alerts';
import { sickCattle, WEIGH_INTERVAL_DAYS } from './attention';
import { batchCattle } from './batch-stats';
import { weighPoints } from './cattle-stats';
import type { SaleReviewRow } from './sale-review';
import type { StockItem, WeightRecord } from './xlsx-parser';

/**
 * Which sale-review alerts to send to Telegram, and how the message reads.
 * Pure: the scheduler gathers the data and the log, this decides and writes.
 */

export type AlertStage = 'window' | 'week' | 'final' | 'overdue';

/** A batch this close to its selling date (or on it) gets a last-days alert. */
export const FINAL_DAYS = 2;

/** Days between reminders while a batch stays past its selling date undecided. */
export const OVERDUE_REMINDER_DAYS = 3;

export interface SentAlert { batchId: string; targetDate: string; stage: AlertStage; sentOn: string }

export interface PlannedAlert {
  row: SaleReviewRow;
  stage: AlertStage;
  targetDate: string;
  /** new = first time at this stage; reminder = still past the date after a few days. */
  kind: 'new' | 'reminder';
}

const stageOf = (row: SaleReviewRow): AlertStage => (row.tier === 'overdue' ? 'overdue' : row.daysRemaining <= FINAL_DAYS ? 'final' : row.tier === 'week' ? 'week' : 'window');
const ORDER: Record<AlertStage, number> = { overdue: 0, final: 1, week: 2, window: 3 };

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetweenDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The alerts to send now: each batch that has newly reached a stage for its
 * current selling date, plus a reminder every few days while it is past the
 * date. Batches already decided "ready to sell" are never alerted.
 */
export function planSaleAlerts(rows: SaleReviewRow[], sent: SentAlert[], today: string, reminderDays: number = OVERDUE_REMINDER_DAYS): PlannedAlert[] {
  const plan: PlannedAlert[] = [];
  for (const row of rows) {
    if (row.decided || !row.batch.sellingTargetDate) continue;
    const stage = stageOf(row);
    const targetDate = row.batch.sellingTargetDate.slice(0, 10);
    const before = sent.filter(s => s.batchId === row.batch.id && s.targetDate === targetDate && s.stage === stage);
    if (before.length === 0) { plan.push({ row, stage, targetDate, kind: 'new' }); continue; }
    if (stage === 'overdue') {
      const last = before.map(s => s.sentOn).sort().pop() as string;
      if (daysBetweenDays(last, today) >= reminderDays) plan.push({ row, stage, targetDate, kind: 'reminder' });
    }
  }
  return plan.sort((a, b) => ORDER[a.stage] - ORDER[b.stage] || a.row.daysRemaining - b.row.daysRemaining || a.row.batch.name.localeCompare(b.row.batch.name));
}

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Oct 2026" for a YYYY-MM-DD day. */
export function prettyDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : day;
}

// ─── What is in each batch ───────────────────────────────────────────────────

export interface AlertAnimal {
  id: string;
  sex: 'M' | 'F' | '?';
  /** The latest recorded weight, kg. */
  weight: number;
  /** Change since the weigh-in before, kg; null when there is only one. */
  change: number | null;
  /** Days since it was last weighed; null when it never was. */
  staleDays: number | null;
}

export interface BatchAlertDetail {
  animals: AlertAnimal[];
  male: number;
  female: number;
  other: number;
  total: number;
  avg: number;
  min: number;
  max: number;
  /** Latest weigh-in day among the animals, YYYY-MM-DD. */
  lastWeighed: string | null;
  /** Days since the most recently weighed animal was weighed; null when none ever was. */
  freshestDays: number | null;
  sick: string[];
  daysFed: number | null;
}

const naturalId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The facts about a batch's animals that the alert shows. Only animals still on the farm count. */
export function batchAlertDetail(batch: SaleReviewRow['batch'], stock: StockItem[], weightTracking: WeightRecord[], today: string): BatchAlertDetail {
  const cattle = batchCattle(batch, stock);
  const sick = new Set(sickCattle(cattle).map(c => c.id));
  const animals: AlertAnimal[] = cattle.map(c => {
    const points = weighPoints(c.id, weightTracking, c.purchaseDate);
    const last = points[points.length - 1];
    return {
      id: c.id,
      sex: (/^m/i.test(c.sex ?? '') ? 'M' : /^f/i.test(c.sex ?? '') ? 'F' : '?') as AlertAnimal['sex'],
      weight: last ? last.weight : c.weight || 0,
      change: last ? last.change : null,
      staleDays: last ? daysBetweenDays(last.date, today) : null,
    };
  }).sort((a, b) => naturalId(a.id, b.id));
  const weights = animals.map(a => a.weight).filter(w => w > 0);
  const dates = cattle.flatMap(c => weighPoints(c.id, weightTracking, c.purchaseDate).slice(-1).map(p => p.date)).sort();
  const start = (batch.startDate ?? '').slice(0, 10);
  return {
    animals,
    male: animals.filter(a => a.sex === 'M').length,
    female: animals.filter(a => a.sex === 'F').length,
    other: animals.filter(a => a.sex === '?').length,
    total: Math.round(weights.reduce((x, y) => x + y, 0) * 10) / 10,
    avg: weights.length ? weights.reduce((x, y) => x + y, 0) / weights.length : 0,
    min: weights.length ? Math.min(...weights) : 0,
    max: weights.length ? Math.max(...weights) : 0,
    lastWeighed: dates.length ? dates[dates.length - 1] : null,
    freshestDays: animals.some(a => a.staleDays !== null) ? Math.min(...animals.filter(a => a.staleDays !== null).map(a => a.staleDays as number)) : null,
    sick: [...sick].sort(naturalId),
    daysFed: /^\d{4}-\d{2}-\d{2}$/.test(start) ? Math.max(0, daysBetweenDays(start, today)) : null,
  };
}

// ─── The messages ────────────────────────────────────────────────────────────

/** Batch messages sent in one go; any more follow on the next check. */
export const MAX_MESSAGES = 12;

const HEADINGS: Record<AlertStage, string> = { overdue: '🔴', final: '🔴', week: '🟠', window: '🟡' };

function stageTitle(p: PlannedAlert): string {
  const d = p.row.daysRemaining;
  const base = p.stage === 'overdue' ? `PAST THE SELLING DATE · ${plural(-d, 'day', 'days')} late`
    : p.stage === 'week' || p.stage === 'final' ? (d === 0 ? 'SELLING DATE IS TODAY' : `SELLING DATE IN ${plural(d, 'DAY', 'DAYS')}`)
    : `COMING UP · in ${plural(d, 'day', 'days')}`;
  return `${HEADINGS[p.stage]} <b>${base}</b>${p.kind === 'reminder' ? ' · <i>reminder</i>' : ''}`;
}

const isOld = (a: AlertAnimal) => a.staleDays === null || a.staleDays > WEIGH_INTERVAL_DAYS;
/** Tags named in the old-weights line before it says "and N more". */
const MAX_TAGS = 8;

/** One batch's message. */
export function buildBatchAlertMessage(p: PlannedAlert, d: BatchAlertDetail, opts: { appUrl?: string }): string {
  const { row } = p;
  const price = row.batch.expectedSellingPrice ?? 0;
  const lines: string[] = [
    stageTitle(p),
    `<b>${escapeHtml(row.batch.name)}</b>`,
    `📍 ${row.farm ? escapeHtml(row.farm) : 'No farm set'}`,
    `📅 Sell by ${prettyDay(p.targetDate)}${d.daysFed !== null ? ` · fed for ${plural(d.daysFed, 'day', 'days')}` : ''}`,
    '',
    d.animals.length === 0
      ? '🐂 No animals in this batch'
      : `🐂 ${plural(d.animals.length, 'animal', 'animals')}: ${d.male} male · ${d.female} female${d.other ? ` · ${d.other} not set` : ''}`,
  ];
  if (d.animals.length > 0) {
    lines.push(`⚖️ Total ${num(d.total)} kg · average ${num(d.avg)} kg`);
    lines.push(`    Lightest ${num(d.min)} kg · heaviest ${num(d.max)} kg`);
    lines.push(`📈 ${row.perDay !== null ? `Gaining ${row.perDay} kg a day` : 'Growth not known yet'}${d.lastWeighed ? ` · last weighed ${prettyDay(d.lastWeighed)}` : ' · never weighed'}`);
    const old = d.animals.filter(isOld);
    if (old.length === d.animals.length) lines.push(d.freshestDays === null ? '⚠ None of these animals has been weighed.' : `⚠ These weights are old: the latest weighing was ${plural(d.freshestDays, 'day', 'days')} ago.`);
    else if (old.length > 0) lines.push(`⚠ ${plural(old.length, 'animal', 'animals')} not weighed for over ${WEIGH_INTERVAL_DAYS} days: ${old.slice(0, MAX_TAGS).map(a => escapeHtml(a.id)).join(', ')}${old.length > MAX_TAGS ? ` and ${old.length - MAX_TAGS} more` : ''}`);
    if (price > 0) lines.push(`💰 Expected ${riel(d.total * price)} (at ${riel(price)} per kg)`);
  }
  if (d.sick.length > 0) lines.push(`🩺 ${plural(d.sick.length, 'sick animal', 'sick animals')}: ${d.sick.map(escapeHtml).join(', ')}`);
  if (row.standardDate) lines.push('⚠ The selling date is the standard 90 days. Check it is right.');
  lines.push('', opts.appUrl ? `Decide in the app: Batches, then Sale review.\n${escapeHtml(opts.appUrl)}` : 'Decide in the app: Batches, then Sale review.');
  return lines.join('\n');
}

/** The short message before the batch messages: today's date and how many batches are at each stage. */
export function buildSaleAlertHeader(plan: PlannedAlert[], opts: { today: string; sending: number }): string {
  const count = (stage: AlertStage) => plan.filter(p => p.stage === stage).length;
  const parts = [
    count('overdue') ? `🔴 ${count('overdue')} past the date` : '',
    count('final') ? `🔴 ${count('final')} in the last days` : '',
    count('week') ? `🟠 ${count('week')} within 7 days` : '',
    count('window') ? `🟡 ${count('window')} coming up` : '',
  ].filter(Boolean);
  const later = plan.length - opts.sending;
  return `🐄 <b>CC Livestock · Sale review</b>\n${prettyDay(opts.today)}\n\n${parts.join('   ')}${later > 0 ? `\n\nShowing ${opts.sending} now; the other ${later} follow shortly.` : ''}`;
}

export interface SaleAlertMessages {
  /** Sent first, only when more than one batch is reported. */
  header: string | null;
  items: { alert: PlannedAlert; text: string }[];
}

/** All the messages for a plan: a header, then one message per batch (at most MAX_MESSAGES). */
export function buildSaleAlertMessages(
  plan: PlannedAlert[],
  detailFor: (alert: PlannedAlert) => BatchAlertDetail,
  opts: { today: string; appUrl?: string }
): SaleAlertMessages {
  const items = plan.slice(0, MAX_MESSAGES).map(alert => ({ alert, text: buildBatchAlertMessage(alert, detailFor(alert), opts) }));
  return { header: plan.length > 1 ? buildSaleAlertHeader(plan, { today: opts.today, sending: items.length }) : null, items };
}

/** The hour (0 to 23) at the farms right now. */
export function farmHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: FARM_TIME_ZONE, hour: '2-digit', hour12: false }).format(now);
  return Number(h) % 24;
}

/** Whether the daily alert is due: switched on, a group chosen, and the send hour has come. */
export function alertsDue(cfg: { telegramEnabled: boolean; chatId: string; sendHour: number }, now: Date = new Date()): boolean {
  return cfg.telegramEnabled && cfg.chatId !== '' && farmHour(now) >= cfg.sendHour;
}

export { addDays, farmToday };
