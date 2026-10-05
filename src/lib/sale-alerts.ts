import { addDays, farmToday, FARM_TIME_ZONE } from './daily-feed';
import { escapeHtml } from './alerts';
import type { SaleReviewRow } from './sale-review';

/**
 * Which sale-review alerts to send to Telegram, and how the message reads.
 * Pure: the scheduler gathers the data and the log, this decides and writes.
 */

export type AlertStage = 'window' | 'week' | 'overdue';

/** Days between reminders while a batch stays past its selling date undecided. */
export const OVERDUE_REMINDER_DAYS = 3;
/** Lines in one message; the rest are summarised so the message stays readable. */
export const MAX_LINES = 15;

export interface SentAlert { batchId: string; targetDate: string; stage: AlertStage; sentOn: string }

export interface PlannedAlert {
  row: SaleReviewRow;
  stage: AlertStage;
  targetDate: string;
  /** new = first time at this stage; reminder = still past the date after a few days. */
  kind: 'new' | 'reminder';
}

const stageOf = (row: SaleReviewRow): AlertStage => (row.tier === 'overdue' ? 'overdue' : row.tier === 'week' ? 'week' : 'window');
const ORDER: Record<AlertStage, number> = { overdue: 0, week: 1, window: 2 };

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

function line(p: PlannedAlert): string {
  const { row } = p;
  const d = row.daysRemaining;
  const when = d < 0 ? `${plural(-d, 'day', 'days')} past the date` : d === 0 ? 'selling date is today' : `in ${plural(d, 'day', 'days')}`;
  const bits = [
    `${plural(row.head, 'animal', 'animals')}`,
    row.head ? `avg ${Math.round(row.avgWeight)} kg` : '',
    row.expectedValue !== null ? `about ${riel(row.expectedValue)}` : '',
  ].filter(Boolean);
  const name = `<b>${escapeHtml(row.batch.name)}</b>${row.farm ? ` (${escapeHtml(row.farm)})` : ''}`;
  return `• ${name}: ${when}, ${p.targetDate}\n   ${bits.join(' · ')}${p.kind === 'reminder' ? ' · <i>reminder</i>' : ''}${row.standardDate ? ' · <i>standard 90-day date</i>' : ''}`;
}

const HEADINGS: Record<AlertStage, string> = {
  overdue: '🔴 <b>Past the selling date</b>',
  week: '🟠 <b>Selling date within 7 days</b>',
  window: '🟡 <b>Coming up</b>',
};

/** The Telegram message (HTML) for the planned alerts. */
export function buildSaleAlertMessage(plan: PlannedAlert[], opts: { today: string; windowDays: number; appUrl?: string }): string {
  const shown = plan.slice(0, MAX_LINES);
  const parts: string[] = [`🐄 <b>CC Livestock · Sale review</b>\n${opts.today}`];
  for (const stage of ['overdue', 'week', 'window'] as AlertStage[]) {
    const group = shown.filter(p => p.stage === stage);
    if (group.length > 0) parts.push(`${HEADINGS[stage]}\n${group.map(line).join('\n')}`);
  }
  if (plan.length > shown.length) parts.push(`…and ${plural(plan.length - shown.length, 'more batch', 'more batches')}. See them all in the app.`);
  parts.push(opts.appUrl ? `Decide in the app: Batches, then Sale review.\n${escapeHtml(opts.appUrl)}` : 'Decide in the app: Batches, then Sale review.');
  return parts.join('\n\n');
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
