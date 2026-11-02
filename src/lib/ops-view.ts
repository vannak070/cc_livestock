/**
 * What the Action plans screens need to show tasks: each task's real-record evidence and its status, built from the
 * data the browser already holds (cattle, sales and feed movements). Pure, so Management and Admin see the same status.
 */
import { isBuybackSale } from './buyback';
import { farmToday } from './daily-feed';
import {
  allocateEvidence, summarize, swaps, taskState,
  type Evidence, type ProgramSummary, type RegistrationRow, type SaleRow, type Task, type TaskState, type TaskStatus,
} from './ops-program';
import type { SalesRecord, StockItem } from './xlsx-parser';

/** The farm-calendar day of a stored date, or '' when there is none. */
const dayOf = (date: string | null | undefined) => (date ? farmToday(new Date(date)) : '');

export interface Records { registrations: RegistrationRow[]; sales: SaleRow[] }

/** A sale to a named buyer other than CC Livestock is the farm's own sale, not a collection. No buyer, "Local Market" (the old default) and CC Livestock all count. */
const countsAsCollection = (s: { buyer?: string }) => {
  const b = (s.buyer ?? '').trim().toLowerCase();
  return b === '' || b === 'local market' || isBuybackSale(s);
};

/**
 * One farm's records: cattle registered on it and sales of its cattle. Calves born on the farm are not cattle sold to
 * it by CC Livestock, and a sale to another named buyer is not a collection, so neither counts toward a task.
 */
export function recordsOfFarm(farm: string, stock: StockItem[], sales: SalesRecord[]): Records {
  const onFarm = new Map(stock.filter(c => c.location === farm).map(c => [c.id, c]));
  return {
    registrations: stock.filter(c => c.location === farm && c.purchaseDate && (c.purchaseType ?? '') !== 'Born in Farm').map(c => ({ date: dayOf(c.purchaseDate), farm })),
    sales: sales.filter(s => onFarm.has(s.cowId) && s.salesDate && countsAsCollection(s)).map(s => ({ date: dayOf(s.salesDate), farm, kg: Number(s.weight) || 0, value: Number(s.totalPrice) || 0 })),
  };
}

/** The price per kg CC Livestock pays for finished cattle on each farm, from its open program (the override, else the Planning plan's selling price). */
export function planPricesByFarm(programs: { farm: string; status: string; buybackPricePerKg?: number; plan?: { sellingPricePerKgKhr?: number } }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of programs) {
    if (p.status === 'Closed') continue;
    const price = p.buybackPricePerKg ?? p.plan?.sellingPricePerKgKhr;
    if (price && price > 0) out.set(p.farm, price);
  }
  return out;
}

export interface TaskView { task: Task; state: TaskState; evidence: Evidence }

/** Every task with its status, evidence matched farm by farm (a program's farm is looked up by program id). */
export function taskViews(tasks: Task[], farmOfProgram: Map<string, string>, stock: StockItem[], sales: SalesRecord[], today = farmToday()): TaskView[] {
  const byFarm = new Map<string, Task[]>();
  for (const t of tasks) {
    const farm = farmOfProgram.get(t.programId);
    if (!farm) continue;
    byFarm.set(farm, [...(byFarm.get(farm) ?? []), t]);
  }
  const out: TaskView[] = [];
  for (const [farm, list] of byFarm) {
    const evidence = allocateEvidence(list, recordsOfFarm(farm, stock, sales));
    for (const task of list) out.push({ task, evidence: evidence.get(task.id) ?? { doneAmount: 0 }, state: taskState(task, evidence.get(task.id), today) });
  }
  return out.sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || a.task.kind.localeCompare(b.task.kind));
}

export function summaryOf(views: TaskView[]): ProgramSummary {
  return summarize(views.map(v => v.task), new Map(views.map(v => [v.task.id, v.state])), new Map(views.map(v => [v.task.id, v.evidence])));
}

/** Status counts for the filter chips. */
export function countByStatus(views: TaskView[]): Record<TaskStatus | 'open' | 'all', number> {
  const base = { planned: 0, due_soon: 0, in_progress: 0, done: 0, late: 0, postponed: 0, cancelled: 0, open: 0, all: views.length };
  for (const v of views) {
    base[v.state.status]++;
    if (v.state.status !== 'done' && v.state.status !== 'cancelled') base.open++;
  }
  return base;
}

/** For each Planning slot, the farms that have an open program (not closed) made from it. */
export function plansInUse(programs: { farm: string; planSlot: number; status: string }[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const p of programs) {
    if (p.status === 'Closed') continue;
    map.set(p.planSlot, [...(map.get(p.planSlot) ?? []), p.farm].sort());
  }
  return map;
}

// ─── The work list operations use ────────────────────────────────────────────

/** Days from `today` to `day` (negative when `day` is past). */
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

const isOpen = (v: TaskView) => v.state.status !== 'done' && v.state.status !== 'cancelled';
const byDue = (a: TaskView, b: TaskView) => a.task.dueDate.localeCompare(b.task.dueDate) || a.task.kind.localeCompare(b.task.kind);

export interface TodoGroups {
  /** Past their date, the most overdue first. */
  late: TaskView[];
  /** Coming up: due within the window (14 days unless asked otherwise), or being worked now. */
  week: TaskView[];
  /** Everything after that. */
  later: TaskView[];
}

/**
 * The open tasks as a work list: what is late, what is coming up in the next `days` days (or already being worked), and the rest.
 * A task being worked stays in "coming up" whatever its date; a postponed one sits where its new date puts it.
 */
export function todoGroups(views: TaskView[], today: string, days = 14): TodoGroups {
  const open = views.filter(isOpen);
  const late = open.filter(v => v.state.status === 'late').sort((a, b) => b.state.daysLate - a.state.daysLate || byDue(a, b));
  const rest = open.filter(v => v.state.status !== 'late');
  const soon = (v: TaskView) => v.state.status === 'in_progress' || daysUntil(v.task.dueDate, today) <= days;
  return { late, week: rest.filter(soon).sort(byDue), later: rest.filter(v => !soon(v)).sort(byDue) };
}

/** Finished and cancelled tasks, newest first; `sinceDays` leaves out older ones (0 = all). */
export function finishedTasks(views: TaskView[], today: string, sinceDays = 30): TaskView[] {
  return views
    .filter(v => !isOpen(v) && (sinceDays <= 0 || daysUntil(v.task.dueDate, today) >= -sinceDays))
    .sort((a, b) => b.task.dueDate.localeCompare(a.task.dueDate) || a.task.kind.localeCompare(b.task.kind));
}

/** What the Today screen says about the farm tasks: how many are late, and how many are due in the next 7 days. */
export function todayCounts(views: TaskView[], farmOfProgram: Map<string, string>, today: string): { late: number; week: number; lateFarms: string[] } {
  const g = todoGroups(views, today, 7);
  const farms = [...new Set(g.late.map(v => farmOfProgram.get(v.task.programId) ?? '').filter(Boolean))].sort();
  return { late: g.late.length, week: g.week.length, lateFarms: farms };
}

// ─── Management's view ───────────────────────────────────────────────────────

/** What a program looks like to these helpers (the repository's FarmProgram has more). */
export interface ProgramRef { id: string; farm: string; planName: string; status: string; buybackPricePerKg?: number; plan?: { sellingPricePerKgKhr?: number } }

export interface FarmRow {
  farm: string;
  plan: string;
  status: string;
  total: number;
  late: number;
  dueSoon: number;
  inProgress: number;
  done: number;
  /** The next task still to do (earliest due date among open tasks). */
  next?: { kind: Task['kind']; dueDate: string; late: boolean };
}

/** One row per farm program: how its tasks stand. Cancelled tasks are left out of the counts. */
export function farmRows(views: TaskView[], programs: ProgramRef[]): FarmRow[] {
  return programs.filter(p => p.status !== 'Closed').map(p => {
    const mine = views.filter(v => v.task.programId === p.id && v.state.status !== 'cancelled');
    const open = mine.filter(v => v.state.status !== 'done').sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate));
    const n = (s: TaskStatus) => mine.filter(v => v.state.status === s).length;
    return {
      farm: p.farm, plan: p.planName, status: p.status, total: mine.length,
      late: n('late'), dueSoon: n('due_soon'), inProgress: n('in_progress'), done: n('done'),
      ...(open[0] ? { next: { kind: open[0].task.kind, dueDate: open[0].task.dueDate, late: open[0].state.status === 'late' } } : {}),
    };
  }).sort((a, b) => b.late - a.late || a.farm.localeCompare(b.farm));
}

export interface MonthBar { month: string; total: number; counts: Record<TaskStatus, number> }

/** Tasks by the month they are due, with their statuses (cancelled ones left out). */
export function monthBars(views: TaskView[]): MonthBar[] {
  const map = new Map<string, MonthBar>();
  for (const v of views) {
    if (v.state.status === 'cancelled') continue;
    const month = v.task.dueDate.slice(0, 7);
    const bar = map.get(month) ?? { month, total: 0, counts: { planned: 0, due_soon: 0, in_progress: 0, done: 0, late: 0, postponed: 0, cancelled: 0 } };
    bar.total++;
    bar.counts[v.state.status]++;
    map.set(month, bar);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Of the tasks that were due by today, how many are done. */
export function completion(views: TaskView[], today = farmToday()): { dueToDate: number; doneToDate: number; pct: number } {
  const due = views.filter(v => v.state.status !== 'cancelled' && v.task.dueDate <= today);
  const done = due.filter(v => v.state.status === 'done').length;
  return { dueToDate: due.length, doneToDate: done, pct: due.length > 0 ? Math.round((done / due.length) * 100) : 100 };
}

/** What Management should look at first: late tasks (most late first), tasks that were postponed, and swaps with one side done. */
export function attention(views: TaskView[]): { late: TaskView[]; delayed: TaskView[] } {
  return {
    late: views.filter(v => v.state.status === 'late').sort((a, b) => b.state.daysLate - a.state.daysLate),
    delayed: views.filter(v => v.state.status === 'postponed' || (v.state.delayDays > 0 && v.state.status !== 'done' && v.state.status !== 'cancelled')).sort((a, b) => b.state.delayDays - a.state.delayDays),
  };
}

/** Same-day swaps per task: 'open' when exactly one side of the day's buy-back and replacement sale is done. */
export function swapStates(views: TaskView[]): Map<string, 'complete' | 'open' | 'waiting'> {
  const map = new Map<string, 'complete' | 'open' | 'waiting'>();
  const status = new Map(views.map(v => [v.task.id, v.state.status]));
  const byProgram = new Map<string, Task[]>();
  for (const v of views) byProgram.set(v.task.programId, [...(byProgram.get(v.task.programId) ?? []), v.task]);
  for (const list of byProgram.values()) {
    for (const s of swaps(list, t => status.get(t.id) ?? 'planned')) for (const t of [...s.buyBack, ...s.sellToFarm]) map.set(t.id, s.state);
  }
  return map;
}

// ─── The Management report's action plan block ───────────────────────────────

export interface PlanKindTotals { tasks: number; done: number; late: number; plannedHead: number; doneHead: number; plannedKg: number; doneKg: number; plannedValue: number; doneValue: number }
export interface PlanLateRow { farm: string; kind: Task['kind']; dueDate: string; daysLate: number; owner: string }
export interface PlanNextRow { farm: string; kind: Task['kind']; dueDate: string; days: number; head?: number; kg?: number; value?: number; late: boolean }

export interface PlanBlock {
  /** Farms with a program in the report's scope. */
  farms: number;
  /** Tasks counted: due in the month, or late / started / moved. Cancelled ones are left out. */
  tasks: number;
  byStatus: Record<TaskStatus, number>;
  completionPct: number;
  delayed: number;
  swapsOpen: number;
  /** The month's tasks by kind (sell to the farm, buy back). */
  byKind: Record<Task['kind'], PlanKindTotals>;
  /** Planned money in the next 30 days that is not done yet (late tasks included): buy-backs we pay, sales to the farms we receive. */
  cashOut30: number;
  cashIn30: number;
  late: PlanLateRow[];
  next: PlanNextRow[];
}

/**
 * What the Management report says about the action plans: how the month's tasks stand, the planned money for the next 30 days
 * and what is late. `programs` are the farm programs in scope; views are their tasks with status.
 */
export function buildPlanBlock(views: TaskView[], programs: ProgramRef[], month: string, today: string): PlanBlock | null {
  const open = programs.filter(p => p.status !== 'Closed');
  if (open.length === 0) return null;
  const farmOf = new Map(open.map(p => [p.id, p.farm]));
  const mine = views.filter(v => farmOf.has(v.task.programId) && v.state.status !== 'cancelled');
  const inScope = mine.filter(v => v.task.dueDate.slice(0, 7) === month || ['late', 'in_progress', 'postponed'].includes(v.state.status));
  const byStatus = { planned: 0, due_soon: 0, in_progress: 0, done: 0, late: 0, postponed: 0, cancelled: 0 } as Record<TaskStatus, number>;
  for (const v of inScope) byStatus[v.state.status]++;
  const kind = (): PlanKindTotals => ({ tasks: 0, done: 0, late: 0, plannedHead: 0, doneHead: 0, plannedKg: 0, doneKg: 0, plannedValue: 0, doneValue: 0 });
  const byKind = { sell_to_farm: kind(), buy_back: kind() } as Record<Task['kind'], PlanKindTotals>;
  for (const v of inScope) {
    const k = byKind[v.task.kind];
    k.tasks++;
    if (v.state.status === 'done') k.done++;
    if (v.state.status === 'late') k.late++;
    k.plannedHead += v.task.plannedHead ?? 0;
    k.plannedKg += v.task.plannedKg ?? 0;
    k.plannedValue += v.task.plannedValue ?? 0;
    k.doneHead += Math.round(v.evidence.doneAmount);
    k.doneValue += v.evidence.doneValue ?? 0;
  }
  const dueDone = mine.filter(v => v.task.dueDate <= today);
  const completionPct = dueDone.length > 0 ? Math.round((dueDone.filter(v => v.state.status === 'done').length / dueDone.length) * 100) : 100;
  const horizon = addDaysLocal(today, 30);
  const notDone = mine.filter(v => v.state.status !== 'done' && v.task.dueDate <= horizon);
  const sumValue = (k: Task['kind']) => Math.round(notDone.filter(v => v.task.kind === k).reduce((s, v) => s + (v.task.plannedValue ?? 0), 0));
  const byId = new Map(mine.map(v => [v.task.id, v.task]));
  const openSwapDays = new Set<string>();
  for (const [id, s] of swapStates(mine)) if (s === 'open') { const t = byId.get(id)!; openSwapDays.add(`${t.programId}|${t.dueDate}`); }
  const swapsOpen = openSwapDays.size;
  const nextOpen = mine.filter(v => v.state.status !== 'done').sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate));
  return {
    farms: open.length,
    tasks: inScope.length,
    byStatus,
    completionPct,
    delayed: inScope.filter(v => v.state.delayDays > 0 || v.state.status === 'postponed').length,
    swapsOpen,
    byKind,
    cashOut30: sumValue('buy_back'),
    cashIn30: sumValue('sell_to_farm'),
    late: attention(mine).late.slice(0, 8).map(v => ({ farm: farmOf.get(v.task.programId) ?? '', kind: v.task.kind, dueDate: v.task.dueDate, daysLate: v.state.daysLate, owner: v.task.owner })),
    next: nextOpen.slice(0, 10).map(v => ({
      farm: farmOf.get(v.task.programId) ?? '', kind: v.task.kind, dueDate: v.task.dueDate, days: Math.round((Date.parse(`${v.task.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
      head: v.task.plannedHead, kg: v.task.plannedKg, value: v.task.plannedValue, late: v.state.status === 'late',
    })),
  };
}

function addDaysLocal(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
