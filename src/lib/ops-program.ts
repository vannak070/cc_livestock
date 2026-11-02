/**
 * Farm programs and operations tasks (migration 027). Browser-safe and pure: the server and the
 * screens use the same rules.
 *
 * A farm program links one farm to one Planning plan and a start date. From the plan's numbers it
 * makes tasks for operations: SELL cattle to the farm and BUY them back (the replacement is sold to the
 * farm the SAME day). Operations work the tasks; Management
 * watches their status. There is no approval step (user, 2026-10-14). Feed is NOT part of the plan (user, 2026-10-15): the
 * action plan is the monthly swap only, on the farm's 3-day slot (src/lib/ops-slots.ts).
 *
 * Defaults chosen 2026-10-15 ("go ahead with defaults"): Due soon = within 7 days; Late = the day
 * after the due date; DSR-16 is delivered monthly in advance; a postponed task is flagged as a delay;
 * existing batches on the farm are running cycles (their buy-back comes from the batch's selling date).
 */
import type { ProposalPlanParams } from '../types/proposal.types';
import { addDays, isDay } from './daily-feed';
import { calculatePlan } from './proposal-plan';
import { planDays } from './plan-months';

// ─── Who may do what ─────────────────────────────────────────────────────────

export { canSeeActionPlans as canSeePrograms, canWritePlans as canManagePrograms } from './action-plans';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type TaskKind = 'sell_to_farm' | 'buy_back';
export const TASK_KINDS: TaskKind[] = ['sell_to_farm', 'buy_back'];

/** What operations set by hand. Everything else about the status comes from the dates and the real records. */
export type ManualState = 'in_progress' | 'postponed' | 'cancelled' | 'done_by_hand';
export const MANUAL_STATES: ManualState[] = ['in_progress', 'postponed', 'cancelled', 'done_by_hand'];

export type TaskStatus = 'planned' | 'due_soon' | 'in_progress' | 'done' | 'late' | 'postponed' | 'cancelled';
export const TASK_STATUSES: TaskStatus[] = ['planned', 'due_soon', 'in_progress', 'done', 'late', 'postponed', 'cancelled'];

/** A task is "due soon" this many days before its due date. */
export const DUE_SOON_DAYS = 7;
/** A late task is flagged severe after this many days. */
export const SEVERE_LATE_DAYS = 7;
export const MAX_HORIZON_MONTHS = 24;
export const DEFAULT_HORIZON_MONTHS = 12;

// ─── Dates ───────────────────────────────────────────────────────────────────

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

/** The same day of the month `n` months on, or the month's last day when it is shorter (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(day: string, n: number): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7)) - 1 + n;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = Math.min(Number(day.slice(8, 10)), last);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

/** A task as made from the plan (before it is saved). */
export interface TaskSeed {
  kind: TaskKind;
  /** 'c0', 'c1', ... planned cycles; 'b:<batch>' a batch already on the farm; 'r:<batch>' its same-day replacement. */
  cycleKey: string;
  /** The feed product for a feed delivery; '' otherwise. */
  product: string;
  batchId?: string;
  dueDate: string;
  plannedHead?: number;
  plannedKg?: number;
  pricePerKg?: number;
  plannedValue?: number;
}

/** A saved task: the seed plus what operations did with it. */
export interface Task extends TaskSeed {
  id: string;
  programId: string;
  originalDueDate: string;
  manualState?: ManualState;
  reason: string;
  owner: string;
  notes: string;
  doneOn?: string;
  doneBy?: string;
  updatedBy: string;
  updatedAt: string;
}

/** The key that makes a task unique inside a program. */
export const taskKey = (t: Pick<TaskSeed, 'kind' | 'cycleKey' | 'product'>) => `${t.kind}|${t.cycleKey}|${t.product}`;

/** What the plan says for a farm. */
export interface ProgramInput {
  farm: string;
  /** The day of the first new cycle (cattle sold to the farm). */
  startDate: string;
  /** Cattle sold to the farm in each monthly cycle. */
  headPerCycle: number;
  plan: ProposalPlanParams;
  /** Riel per kg overrides; the plan's own prices when missing. */
  purchasePricePerKg?: number;
  buybackPricePerKg?: number;
  horizonMonths?: number;
}

/** A batch already on the farm: it is a running cycle, bought back on its selling date. */
export interface RunningBatch {
  batchId: string;
  name: string;
  head: number;
  estKg: number;
  /** The batch's selling target date; missing = no date yet. */
  dueDate?: string;
}

/** What is wrong with the program's setup, or null. */
export function programProblem(p: ProgramInput): string | null {
  if (!(p.farm ?? '').trim()) return 'Choose a farm.';
  if (!isDay(p.startDate)) return 'Choose the day the first cattle are sold to the farm.';
  if (!Number.isInteger(p.headPerCycle) || p.headPerCycle < 1 || p.headPerCycle > 10_000) return 'Enter how many cattle are sold to the farm each month (a whole number).';
  if (!p.plan || !(p.plan.fatteningPeriodDays > 0) || !(p.plan.initialWeightKg > 0)) return 'The Planning plan is not complete. Open it in Planning and check its numbers.';
  for (const price of [p.purchasePricePerKg, p.buybackPricePerKg]) {
    if (price !== undefined && !(Number.isFinite(price) && price > 0 && price <= 1_000_000)) return 'Enter a price per kg in riel (more than 0), or leave it empty to use the plan\'s price.';
  }
  const h = p.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  if (!Number.isInteger(h) || h < 1 || h > MAX_HORIZON_MONTHS) return `Plan between 1 and ${MAX_HORIZON_MONTHS} months ahead.`;
  return null;
}

/** The plan's cycle length in months (the plan trades monthly). */
export const cycleMonths = (plan: ProposalPlanParams) => calculatePlan(plan).fatteningMonths;

/** What the plan suggests for cattle sold to the farm each month (its monthly batch). */
export const suggestedHeadPerCycle = (plan: ProposalPlanParams) => calculatePlan(plan).monthlyBatchQty;

const sellValue = (head: number, plan: ProposalPlanParams, price: number) => Math.round(head * plan.initialWeightKg * price);
const finalKg = (plan: ProposalPlanParams) => plan.initialWeightKg + plan.dailyWeightGainKg * planDays(plan);

/**
 * The tasks a program needs:
 *  - for each running batch on the farm: its buy-back on the selling date, and the replacement sold the same day;
 *  - for each monthly cycle from the start date: cattle sold to the farm, and the same cattle bought back
 *    `cycleMonths` later (the buy-back day is also the day a later cycle's cattle are sold, so the swap is one day);
 * Nothing before `today` is made for the planned cycles, and a batch with no selling date makes no task (it is returned in `undated`).
 */
export function generateTasks(input: ProgramInput, running: RunningBatch[] = []): { tasks: TaskSeed[]; undated: RunningBatch[] } {
  const { plan, startDate, headPerCycle } = input;
  const horizon = input.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const buyPrice = input.buybackPricePerKg ?? plan.sellingPricePerKgKhr;
  const sellPrice = input.purchasePricePerKg ?? plan.purchasePricePerKgKhr;
  const F = cycleMonths(plan);
  const tasks: TaskSeed[] = [];
  const undated: RunningBatch[] = [];
  const endDay = addMonths(startDate, horizon);

  for (const b of running) {
    if (!b.dueDate || !isDay(b.dueDate)) { undated.push(b); continue; }
    tasks.push({ kind: 'buy_back', cycleKey: `b:${b.batchId}`, product: '', batchId: b.batchId, dueDate: b.dueDate, plannedHead: b.head, plannedKg: Math.round(b.estKg), pricePerKg: buyPrice, plannedValue: Math.round(b.estKg * buyPrice) });
    tasks.push({ kind: 'sell_to_farm', cycleKey: `r:${b.batchId}`, product: '', dueDate: b.dueDate, plannedHead: b.head, plannedKg: Math.round(b.head * plan.initialWeightKg), pricePerKg: sellPrice, plannedValue: sellValue(b.head, plan, sellPrice) });
  }

  for (let k = 0; k < horizon; k++) {
    const sellDay = addMonths(startDate, k);
    tasks.push({ kind: 'sell_to_farm', cycleKey: `c${k}`, product: '', dueDate: sellDay, plannedHead: headPerCycle, plannedKg: Math.round(headPerCycle * plan.initialWeightKg), pricePerKg: sellPrice, plannedValue: sellValue(headPerCycle, plan, sellPrice) });
    const buyDay = addMonths(startDate, k + F);
    if (buyDay <= endDay) {
      const kg = Math.round(headPerCycle * finalKg(plan));
      tasks.push({ kind: 'buy_back', cycleKey: `c${k}`, product: '', dueDate: buyDay, plannedHead: headPerCycle, plannedKg: kg, pricePerKg: buyPrice, plannedValue: Math.round(kg * buyPrice) });
    }
  }

  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.kind.localeCompare(b.kind) || a.cycleKey.localeCompare(b.cycleKey));
  return { tasks, undated };
}

// ─── The farm's cattle limit ─────────────────────────────────────────────────

/**
 * Every animal registered on a farm counts toward its limit, sold ones too (src/lib/farm-limit.ts), so a
 * program that sells `headPerCycle` cattle a month uses that many places every month.
 */
export function limitCheck(placesLeft: number, headPerCycle: number, horizonMonths = DEFAULT_HORIZON_MONTHS, running?: { startDate: string; today: string }): { needed: number; placesLeft: number; enough: boolean; monthsCovered: number } {
  // A program already under way has registered its first cohorts (they are in the places already used): only the cohorts still to come need room.
  let months = horizonMonths;
  if (running) for (let k = 0; k < horizonMonths; k++) if (addMonths(running.startDate, k) <= running.today) months--;
  const needed = headPerCycle * Math.max(0, months);
  return { needed, placesLeft, enough: placesLeft >= needed, monthsCovered: headPerCycle > 0 ? Math.min(months, Math.floor(placesLeft / headPerCycle)) : 0 };
}

// ─── The real records ────────────────────────────────────────────────────────

/** Cattle registered on a farm (one per animal). */
export interface RegistrationRow { date: string; farm: string }
/** A sale of a farm's cattle. */
export interface SaleRow { date: string; farm: string; kg: number; value: number }

export interface Evidence {
  /** Cattle registered / sold that count toward the task. */
  doneAmount: number;
  /** Kg and riel of the sales that count (buy-backs). */
  doneKg?: number;
  doneValue?: number;
}

/** Records may count toward a task from this many days before its due date. */
const EARLY_DAYS: Record<TaskKind, number> = { sell_to_farm: 14, buy_back: 30 };

const amountPlanned = (t: Pick<Task, 'plannedHead'>) => t.plannedHead ?? 0;

/**
 * First in, first out: records are matched to the farm's tasks in date order. A record counts toward the
 * earliest task of its kind that still needs more and whose window has opened (the due date less a few
 * days). Records before any task's window are not part of the program. The caller decides which records count
 * (ops-view `recordsOfFarm`: not calves born on the farm, not a sale to another named buyer); every record it
 * passes counts toward the earliest open task of its kind.
 */
export function allocateEvidence(tasks: Pick<Task, 'id' | 'kind' | 'dueDate' | 'plannedHead'>[], records: { registrations: RegistrationRow[]; sales: SaleRow[] }): Map<string, Evidence> {
  const out = new Map<string, Evidence>(tasks.map(t => [t.id, { doneAmount: 0 }]));
  const take = <R extends { date: string }>(kind: TaskKind, rows: R[], matches: (t: typeof tasks[number], r: R) => boolean, amountOf: (r: R) => number, onTake?: (e: Evidence, r: R, used: number, amount: number) => void) => {
    const mine = tasks.filter(t => t.kind === kind).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
      let amount = amountOf(r);
      const total = amount;
      for (const t of mine) {
        if (amount <= 0) break;
        if (!matches(t, r) || r.date < addDays(t.dueDate, -EARLY_DAYS[kind])) continue;
        const e = out.get(t.id)!;
        const room = amountPlanned(t) - e.doneAmount;
        if (room <= 0) continue;
        const used = Math.min(room, amount);
        e.doneAmount += used;
        onTake?.(e, r, used, total);
        amount -= used;
      }
    }
  };
  take('sell_to_farm', records.registrations, () => true, () => 1);
  take('buy_back', records.sales, () => true, () => 1, (e, r, used) => { e.doneKg = (e.doneKg ?? 0) + r.kg * used; e.doneValue = (e.doneValue ?? 0) + r.value * used; });
  return out;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface TaskState {
  status: TaskStatus;
  /** Days past the due date; 0 when not late. */
  daysLate: number;
  /** Days the task was moved from its first due date (0 when never moved). */
  delayDays: number;
  /** 0 to 1: how much of the planned amount the real records show. */
  progress: number;
  /** Done only because someone marked it by hand; the records do not show it (yet). */
  byHand: boolean;
  /** A late task that is 7 or more days late. */
  severe: boolean;
}

/**
 * The status shown for a task. Order of the rules:
 *  1 cancelled; 2 done (the records show the whole amount, or marked by hand); 3 postponed until the new date has passed;
 *  4 late (past due and not done), even when partly done; 5 in progress (set by hand, or the records show part);
 *  6 due soon (within 7 days); 7 planned.
 */
export function taskState(t: Pick<Task, 'dueDate' | 'originalDueDate' | 'plannedHead' | 'manualState'>, evidence: Evidence | undefined, today: string): TaskState {
  const planned = amountPlanned(t);
  const amount = evidence?.doneAmount ?? 0;
  const progress = planned > 0 ? Math.min(1, amount / planned) : 0;
  const delayDays = Math.max(0, daysBetween(t.originalDueDate, t.dueDate));
  const late = Math.max(0, daysBetween(t.dueDate, today));
  const base = { daysLate: 0, delayDays, progress, byHand: false, severe: false };

  if (t.manualState === 'cancelled') return { ...base, status: 'cancelled' };
  const recordsDone = planned > 0 && amount >= planned;
  if (recordsDone || t.manualState === 'done_by_hand') {
    return { ...base, status: 'done', progress: recordsDone ? 1 : progress, byHand: !recordsDone };
  }
  if (late > 0) return { ...base, status: 'late', daysLate: late, severe: late >= SEVERE_LATE_DAYS };
  if (t.manualState === 'postponed') return { ...base, status: 'postponed' };
  if (t.manualState === 'in_progress' || amount > 0) return { ...base, status: 'in_progress' };
  return { ...base, status: daysBetween(today, t.dueDate) <= DUE_SOON_DAYS ? 'due_soon' : 'planned' };
}

// ─── Changes by operations ───────────────────────────────────────────────────

export type TaskChange =
  | { action: 'start'; owner?: string; note?: string }
  | { action: 'postpone'; newDueDate: string; reason: string }
  | { action: 'cancel'; reason: string }
  | { action: 'done'; note: string; doneOn?: string }
  | { action: 'reopen' }
  | { action: 'adjust'; plannedHead?: number; plannedKg?: number; pricePerKg?: number; reason: string }
  | { action: 'note'; owner?: string; notes?: string };

/** What is wrong with a change to a task, or null. A reason is always required when the plan is changed. */
export function taskChangeProblem(task: Pick<Task, 'dueDate' | 'manualState'>, change: TaskChange, today: string): string | null {
  const reason = (s: string | undefined) => (s ?? '').trim().length >= 3;
  switch (change.action) {
    case 'start': return task.manualState === 'cancelled' ? 'A cancelled task cannot be started. Reopen it first.' : null;
    case 'postpone':
      if (!isDay(change.newDueDate)) return 'Choose the new due date.';
      if (change.newDueDate === task.dueDate) return 'Choose a date different from the current due date.';
      if (change.newDueDate < today) return 'The new due date cannot be in the past.';
      return reason(change.reason) ? null : 'Write why the task is postponed.';
    case 'cancel': return reason(change.reason) ? null : 'Write why the task is cancelled.';
    case 'done':
      if (change.doneOn !== undefined && (!isDay(change.doneOn) || change.doneOn > today)) return 'Choose the day it was done (not in the future).';
      return reason(change.note) ? null : 'Write a short note on how it was done, so Management can follow it.';
    case 'reopen': return task.manualState ? null : 'This task has nothing to reopen.';
    case 'adjust':
      if (change.plannedHead !== undefined && !(Number.isInteger(change.plannedHead) && change.plannedHead >= 1 && change.plannedHead <= 10_000)) return 'Enter the number of cattle as a whole number.';
      if (change.plannedKg !== undefined && !(Number.isFinite(change.plannedKg) && change.plannedKg > 0)) return 'Enter the weight in kg (more than 0).';
      if (change.pricePerKg !== undefined && !(Number.isFinite(change.pricePerKg) && change.pricePerKg > 0 && change.pricePerKg <= 1_000_000)) return 'Enter the price per kg in riel (more than 0).';
      if (change.plannedHead === undefined && change.plannedKg === undefined && change.pricePerKg === undefined) return 'Change the head, the weight or the price.';
      return reason(change.reason) ? null : 'Write why the plan is changed.';
    case 'note': return (change.notes ?? '').length > 1000 ? 'Keep the notes to 1,000 characters.' : (change.owner ?? '').length > 100 ? 'Keep the owner to 100 characters.' : null;
  }
}

// ─── Same-day swaps ──────────────────────────────────────────────────────────

export interface SwapState {
  date: string;
  /** Buy-backs and replacement sales planned that day. */
  buyBack: Task[];
  sellToFarm: Task[];
  /** both done; one side open (a swap is "open" when exactly one side is done); none done. */
  state: 'complete' | 'open' | 'waiting';
}

/**
 * Days with both a buy-back and a sale to the farm are swaps: the harvested cattle go and the
 * replacement comes the same day. A swap is open when one side is done and the other is not.
 */
export function swaps(tasks: Task[], statusOf: (t: Task) => TaskStatus): SwapState[] {
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.manualState === 'cancelled') continue;
    byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t]);
  }
  const out: SwapState[] = [];
  for (const [date, list] of [...byDay].sort((a, b) => a[0].localeCompare(b[0]))) {
    const buyBack = list.filter(t => t.kind === 'buy_back');
    const sellToFarm = list.filter(t => t.kind === 'sell_to_farm');
    if (buyBack.length === 0 || sellToFarm.length === 0) continue;
    const done = (ts: Task[]) => ts.every(t => statusOf(t) === 'done');
    const any = [...buyBack, ...sellToFarm].some(t => statusOf(t) === 'done');
    out.push({ date, buyBack, sellToFarm, state: done(buyBack) && done(sellToFarm) ? 'complete' : any ? 'open' : 'waiting' });
  }
  return out;
}

// ─── Summary for Management ──────────────────────────────────────────────────

export interface KindTotals { tasks: number; done: number; late: number; plannedHead: number; doneHead: number; plannedKg: number; plannedValue: number }
export interface ProgramSummary {
  byStatus: Record<TaskStatus, number>;
  byKind: Record<TaskKind, KindTotals>;
  /** Tasks late, most overdue first. */
  lateTasks: { task: Task; daysLate: number; severe: boolean }[];
  /** Postponed or moved tasks (a flagged delay). */
  delayed: number;
  swapsOpen: number;
}

export function summarize(tasks: Task[], states: Map<string, TaskState>, evidence: Map<string, Evidence>): ProgramSummary {
  const byStatus = Object.fromEntries(TASK_STATUSES.map(s => [s, 0])) as Record<TaskStatus, number>;
  const empty = (): KindTotals => ({ tasks: 0, done: 0, late: 0, plannedHead: 0, doneHead: 0, plannedKg: 0, plannedValue: 0 });
  const byKind = { sell_to_farm: empty(), buy_back: empty() } as Record<TaskKind, KindTotals>;
  const lateTasks: ProgramSummary['lateTasks'] = [];
  let delayed = 0;
  for (const t of tasks) {
    const s = states.get(t.id);
    if (!s) continue;
    byStatus[s.status]++;
    if (s.delayDays > 0 || s.status === 'postponed') delayed++;
    if (s.status === 'cancelled') continue;
    const k = byKind[t.kind];
    k.tasks++;
    if (s.status === 'done') k.done++;
    if (s.status === 'late') { k.late++; lateTasks.push({ task: t, daysLate: s.daysLate, severe: s.severe }); }
    k.plannedHead += t.plannedHead ?? 0;
    k.doneHead += Math.round(evidence.get(t.id)?.doneAmount ?? 0);
    k.plannedKg += t.plannedKg ?? 0;
    k.plannedValue += t.plannedValue ?? 0;
  }
  lateTasks.sort((a, b) => b.daysLate - a.daysLate);
  const open = swaps(tasks, t => states.get(t.id)?.status ?? 'planned').filter(s => s.state === 'open').length;
  return { byStatus, byKind, lateTasks, delayed, swapsOpen: open };
}
