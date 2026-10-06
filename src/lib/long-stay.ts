import type { CattleFollowUp, FollowUpAction, StockItem } from './types';

/**
 * Cattle that have stayed on a farm a long time without being sold, so the
 * office can decide and write down what happens next (sell, keep fattening,
 * treat, weigh again...). The time is an admin setting (Settings → Lists),
 * 6 months when unset. Pure and browser-safe: the screens and the server use
 * the same rules.
 */

export const LONG_STAY_DEFAULT_MONTHS = 6;
export const LONG_STAY_MIN_MONTHS = 1;
export const LONG_STAY_MAX_MONTHS = 24;

export const FOLLOW_UP_ACTIONS: FollowUpAction[] = ['sell', 'keep', 'treat', 'weigh', 'other'];

/** The longest a note may be, and how far ahead a due date may go. */
export const FOLLOW_UP_NOTE_MAX = 500;
export const FOLLOW_UP_MAX_DAYS_AHEAD = 366;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The months from settings: a whole number from 1 to 24, else 6. */
export function longStayMonths(settings: { longStayMonths?: number } | null | undefined): number {
  const n = settings?.longStayMonths;
  return Number.isInteger(n) && (n as number) >= LONG_STAY_MIN_MONTHS && (n as number) <= LONG_STAY_MAX_MONTHS ? (n as number) : LONG_STAY_DEFAULT_MONTHS;
}

/** Why a chosen number of months cannot be saved, or null. */
export function longStayMonthsProblem(value: unknown): string | null {
  return Number.isInteger(value) && (value as number) >= LONG_STAY_MIN_MONTHS && (value as number) <= LONG_STAY_MAX_MONTHS
    ? null
    : `Choose a whole number of months from ${LONG_STAY_MIN_MONTHS} to ${LONG_STAY_MAX_MONTHS}.`;
}

/** A YYYY-MM-DD day moved by whole calendar months (31 Aug + 6 months = 28/29 Feb). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Whole months from one day to another (counted the same way as addMonths). */
export function monthsBetween(from: string, to: string): number {
  let n = 0;
  while (n < 600 && addMonths(from, n + 1) <= to) n++;
  return n;
}

/** The day an animal arrived on the farm, as YYYY-MM-DD; undefined when unknown. */
export const arrivalDay = (cow: Pick<StockItem, 'purchaseDate'>): string | undefined => {
  const d = cow.purchaseDate?.slice(0, 10);
  return d && DAY.test(d) ? d : undefined;
};

/** The animal's next action: its newest follow-up that is not done yet. */
export function openFollowUp(cowId: string, followUps: CattleFollowUp[]): CattleFollowUp | undefined {
  return followUps
    .filter(f => f.cowId === cowId && !f.doneAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export interface LongStayRow {
  cow: StockItem;
  arrival: string;
  days: number;
  months: number;
  next?: CattleFollowUp;
  /** The next action's due date has passed. */
  overdue: boolean;
}

/** Active cattle on the farm for `months` or more, longest first. `today` is the farm's YYYY-MM-DD day. */
export function longStayCattle(stock: StockItem[], months: number, followUps: CattleFollowUp[], today: string): LongStayRow[] {
  const rows: LongStayRow[] = [];
  for (const cow of stock) {
    if (cow.status.toLowerCase() !== 'active') continue;
    const arrival = arrivalDay(cow);
    if (!arrival || addMonths(arrival, months) > today) continue;
    const next = openFollowUp(cow.id, followUps);
    rows.push({ cow, arrival, days: daysBetween(arrival, today), months: monthsBetween(arrival, today), next, overdue: !!next?.dueDate && next.dueDate < today });
  }
  return rows.sort((a, b) => a.arrival.localeCompare(b.arrival) || a.cow.id.localeCompare(b.cow.id));
}

export interface FollowUpInput {
  action: FollowUpAction;
  note: string;
  /** YYYY-MM-DD or empty. */
  dueDate: string;
}

/** Why a next action cannot be saved, or null. `today` is the farm's YYYY-MM-DD day. */
export function followUpProblem(input: FollowUpInput, today: string): string | null {
  if (!FOLLOW_UP_ACTIONS.includes(input.action)) return 'Choose what happens next.';
  const note = (input.note ?? '').trim();
  if (note.length > FOLLOW_UP_NOTE_MAX) return `Keep the note under ${FOLLOW_UP_NOTE_MAX} letters.`;
  if (input.action === 'other' && !note) return 'Write what happens next.';
  if (input.dueDate) {
    if (!DAY.test(input.dueDate) || Number.isNaN(Date.parse(`${input.dueDate}T00:00:00Z`))) return 'Choose a real date.';
    if (input.dueDate < today) return 'Choose today or a later date.';
    if (daysBetween(today, input.dueDate) > FOLLOW_UP_MAX_DAYS_AHEAD) return 'Choose a date within a year.';
  }
  return null;
}
