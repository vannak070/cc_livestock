/** Month calendar maths for the farm programs screen (Monday first). Pure. */
import { addDays } from './daily-feed';

export interface CalendarDay { day: string; inMonth: boolean }

/** The weeks that show a YYYY-MM month: 5 or 6 rows of 7 days, Monday first, with the neighbouring months' days faded. */
export function monthGrid(month: string): CalendarDay[][] {
  const first = `${month}-01`;
  // 0 = Monday ... 6 = Sunday
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -lead);
  const last = lastDayOf(month);
  const weeks: CalendarDay[][] = [];
  let day = start;
  while (day <= last || weeks.length === 0 || weeks[weeks.length - 1].length < 7) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) { week.push({ day, inMonth: day.slice(0, 7) === month }); day = addDays(day, 1); }
    weeks.push(week);
    if (day > last) break;
  }
  return weeks;
}

export function lastDayOf(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, '0')}`;
}

export function shiftMonth(month: string, by: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + by;
  const year = y + Math.floor(m / 12);
  return `${year}-${String(((m % 12) + 12) % 12 + 1).padStart(2, '0')}`;
}

/** Monday-first weekday short names for English (Khmer uses KM_WEEKDAYS). */
export const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Moving tasks by drag and drop ───────────────────────────────────────────

import type { Task, TaskStatus } from './ops-program';

/** A task that is still to be done can be moved; one that is done or cancelled stays where it happened. */
export const canMoveTask = (status: TaskStatus): boolean => status !== 'done' && status !== 'cancelled';

/** Whether a task due on `from` may be dropped on `to`: a different day that is not in the past. */
export function canDropOn(from: string, to: string, today: string): boolean {
  return to !== from && to >= today;
}

/**
 * The task that goes with this one on an exchange day: a collection and its same-day sale to the farm, from the
 * same program. Moving one half alone would break the exchange, so the screen offers to move both.
 */
export function exchangePartner<T extends { task: Pick<Task, 'id' | 'programId' | 'kind' | 'dueDate'>; state: { status: TaskStatus } }>(views: T[], task: Pick<Task, 'id' | 'programId' | 'kind' | 'dueDate'>): T | undefined {
  return views.find(v => v.task.id !== task.id && v.task.programId === task.programId && v.task.dueDate === task.dueDate && v.task.kind !== task.kind && canMoveTask(v.state.status));
}

/** Calendar colours for farms, in the order given (a farm keeps its colour while the list stays the same). */
export const FARM_COLORS = [
  { bar: 'border-l-emerald-600', dot: 'bg-emerald-600' },
  { bar: 'border-l-sky-600', dot: 'bg-sky-600' },
  { bar: 'border-l-fuchsia-600', dot: 'bg-fuchsia-600' },
  { bar: 'border-l-amber-600', dot: 'bg-amber-600' },
  { bar: 'border-l-indigo-600', dot: 'bg-indigo-600' },
  { bar: 'border-l-rose-600', dot: 'bg-rose-600' },
  { bar: 'border-l-teal-600', dot: 'bg-teal-600' },
  { bar: 'border-l-orange-600', dot: 'bg-orange-600' },
  { bar: 'border-l-lime-600', dot: 'bg-lime-600' },
  { bar: 'border-l-cyan-600', dot: 'bg-cyan-600' },
] as const;

export type FarmColor = (typeof FARM_COLORS)[number];

export function farmColorMap(farms: string[]): Map<string, FarmColor> {
  const sorted = [...new Set(farms)].sort((a, b) => a.localeCompare(b));
  return new Map(sorted.map((f, i) => [f, FARM_COLORS[i % FARM_COLORS.length]]));
}
