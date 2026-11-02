import { describe, expect, it } from 'vitest';
import {
  addMonths, allocateEvidence, generateTasks, limitCheck, programProblem, summarize, swaps, taskChangeProblem, taskState,
  type Evidence, type ProgramInput, type Task,
} from './ops-program';
import { DEFAULT_PLAN } from './proposal-plan';

// The default plan: 120 days (4 months), 300 kg at 11,000 ៛/kg bought, 1.25 kg a day gain (450 kg), 12,500 ៛/kg sold.
const input = (over: Partial<ProgramInput> = {}): ProgramInput => ({ farm: 'SNR Farm', startDate: '2026-11-05', headPerCycle: 10, plan: DEFAULT_PLAN, ...over });
const withDsr = { ...DEFAULT_PLAN, feedLines: [{ name: 'DSR-16 Cow Feed', kgPerHeadDay: 7, pricePerKgKhr: 1200 }, { name: 'Super Napier', kgPerHeadDay: 30, pricePerKgKhr: 200 }] };

const task = (over: Partial<Task> = {}): Task => ({
  id: 'T1', programId: 'P1', kind: 'sell_to_farm', cycleKey: 'c0', product: '', dueDate: '2026-11-10', originalDueDate: '2026-11-10', plannedHead: 10, plannedKg: 3000,
  reason: '', owner: '', notes: '', updatedBy: '', updatedAt: '', ...over,
});

describe('addMonths', () => {
  it('keeps the day of the month, or the last day when the month is shorter', () => {
    expect(addMonths('2026-11-05', 4)).toBe('2027-03-05');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-11-05', 0)).toBe('2026-11-05');
    expect(addMonths('2026-03-15', -4)).toBe('2025-11-15');
  });
});

describe('programProblem', () => {
  it('accepts a good setup', () => expect(programProblem(input())).toBeNull());
  it('names what is wrong', () => {
    expect(programProblem(input({ farm: ' ' }))).toMatch(/farm/i);
    expect(programProblem(input({ startDate: 'tomorrow' }))).toMatch(/day/i);
    expect(programProblem(input({ headPerCycle: 0 }))).toMatch(/cattle/i);
    expect(programProblem(input({ headPerCycle: 2.5 }))).toMatch(/whole/i);
    expect(programProblem(input({ purchasePricePerKg: -5 }))).toMatch(/price/i);
    expect(programProblem(input({ horizonMonths: 99 }))).toMatch(/months/i);
    expect(programProblem(input({ plan: { ...DEFAULT_PLAN, fatteningPeriodDays: 0 } }))).toMatch(/Planning/);
  });
});

describe('generateTasks', () => {
  const { tasks } = generateTasks(input());
  const of = (kind: string, key: string) => tasks.find(t => t.kind === kind && t.cycleKey === key)!;

  it('sells cattle to the farm every month from the start day, and buys each cycle back 4 months later', () => {
    expect(tasks.filter(t => t.kind === 'sell_to_farm')).toHaveLength(12);
    expect(of('sell_to_farm', 'c0').dueDate).toBe('2026-11-05');
    expect(of('sell_to_farm', 'c11').dueDate).toBe('2027-10-05');
    expect(of('buy_back', 'c0').dueDate).toBe('2027-03-05');
    // only buy-backs inside the 12 months are made: cycles 0..8
    expect(tasks.filter(t => t.kind === 'buy_back')).toHaveLength(9);
  });

  it('puts the replacement sale on the same day as the buy-back', () => {
    expect(of('buy_back', 'c0').dueDate).toBe(of('sell_to_farm', 'c4').dueDate);
    expect(of('buy_back', 'c5').dueDate).toBe(of('sell_to_farm', 'c9').dueDate);
  });

  it('counts the plan\'s weights and prices into each task', () => {
    expect(of('sell_to_farm', 'c0')).toMatchObject({ plannedHead: 10, plannedKg: 3000, pricePerKg: 11000, plannedValue: 33_000_000 });
    expect(of('buy_back', 'c0')).toMatchObject({ plannedHead: 10, plannedKg: 4500, pricePerKg: 12500, plannedValue: 56_250_000 });
  });

  it('uses price overrides when given', () => {
    const t = generateTasks(input({ purchasePricePerKg: 10000, buybackPricePerKg: 13000 })).tasks;
    expect(t.find(x => x.kind === 'sell_to_farm')!.plannedValue).toBe(30_000_000);
    expect(t.find(x => x.kind === 'buy_back')!.plannedValue).toBe(58_500_000);
  });

  it('is sorted by day and never makes the same task twice', () => {
    const keys = tasks.map(t => `${t.kind}|${t.cycleKey}|${t.product}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...tasks].map(t => t.dueDate)).toEqual([...tasks].map(t => t.dueDate).sort());
  });

  it('makes a buy-back and a same-day replacement for a batch already on the farm, and reports a batch with no date', () => {
    const r = generateTasks(input(), [
      { batchId: 'B1', name: 'Batch01', head: 24, estKg: 8024, dueDate: '2026-10-10' },
      { batchId: 'B2', name: 'Batch02', head: 29, estKg: 9287 },
    ]);
    expect(r.undated.map(b => b.batchId)).toEqual(['B2']);
    const buy = r.tasks.find(t => t.cycleKey === 'b:B1')!;
    const repl = r.tasks.find(t => t.cycleKey === 'r:B1')!;
    expect(buy).toMatchObject({ kind: 'buy_back', batchId: 'B1', dueDate: '2026-10-10', plannedHead: 24, plannedKg: 8024, plannedValue: 100_300_000 });
    expect(repl).toMatchObject({ kind: 'sell_to_farm', dueDate: '2026-10-10', plannedHead: 24, plannedKg: 7200 });
    expect(r.tasks.some(t => t.cycleKey.includes('B2'))).toBe(false);
  });

  it('makes no feed task: feed is not part of the action plan, whatever feed lines the plan has', () => {
    const r = generateTasks(input({ plan: withDsr }), [{ batchId: 'B1', name: 'B', head: 20, estKg: 6000, dueDate: '2026-12-20' }]);
    expect(r.tasks.every(t => t.kind === 'sell_to_farm' || t.kind === 'buy_back')).toBe(true);
    expect(r.tasks.filter(t => t.cycleKey.startsWith('c')).length).toBe(21); // 12 sales to the farm + 9 buy-backs
  });
});

describe('limitCheck', () => {
  it('counts every month\'s cattle, since sold cattle still use a place', () => {
    expect(limitCheck(5, 10)).toEqual({ needed: 120, placesLeft: 5, enough: false, monthsCovered: 0 });
    expect(limitCheck(130, 10)).toMatchObject({ enough: true, monthsCovered: 12 });
    expect(limitCheck(35, 10)).toMatchObject({ enough: false, monthsCovered: 3 });
  });
});

describe('limitCheck for a program already under way', () => {
  it('only needs room for the cohorts still to come', () => {
    // started 5 months before today: 6 cohorts are registered (the 5th month's day has passed), 6 are still to come
    expect(limitCheck(130, 20, 12, { startDate: '2026-05-02', today: '2026-10-15' })).toEqual({ needed: 120, placesLeft: 130, enough: true, monthsCovered: 6 });
    expect(limitCheck(50, 20, 12, { startDate: '2026-05-02', today: '2026-10-15' })).toMatchObject({ needed: 120, enough: false, monthsCovered: 2 });
  });
});

describe('allocateEvidence', () => {
  const sells = [task({ id: 'S1', dueDate: '2026-11-05', plannedHead: 3 }), task({ id: 'S2', cycleKey: 'c1', dueDate: '2026-12-05', plannedHead: 3 })];
  const reg = (date: string) => ({ date, farm: 'SNR Farm' });

  it('matches registrations to the earliest task that still needs cattle', () => {
    const e = allocateEvidence(sells, { registrations: ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-12-04'].map(reg), sales: [] });
    expect(e.get('S1')!.doneAmount).toBe(3);
    // 7 Nov is an extra animal: the next task's window (from 21 Nov) has not opened, so it is not counted; 4 Dec counts.
    expect(e.get('S2')!.doneAmount).toBe(1);
  });

  it('ignores cattle registered long before the first task (not part of the program)', () => {
    const e = allocateEvidence(sells, { registrations: [reg('2026-09-01'), reg('2026-10-01')], sales: [] });
    expect(e.get('S1')!.doneAmount).toBe(0);
  });

  it('counts a sale toward a buy-back with its weight and value', () => {
    const buy = task({ id: 'B1', kind: 'buy_back', dueDate: '2026-10-10', plannedHead: 2, plannedKg: 700 });
    const e = allocateEvidence([buy], { registrations: [], sales: [{ date: '2026-10-11', farm: 'SNR Farm', kg: 350, value: 4_375_000 }, { date: '2026-10-12', farm: 'SNR Farm', kg: 360, value: 4_500_000 }, { date: '2026-10-13', farm: 'SNR Farm', kg: 300, value: 3_000_000 }] });
    expect(e.get('B1')).toEqual({ doneAmount: 2, doneKg: 710, doneValue: 8_875_000 });
  });

});

describe('taskState', () => {
  const today = '2026-11-01';
  const ev = (n: number): Evidence => ({ doneAmount: n });

  it('is planned far ahead, due soon within 7 days', () => {
    expect(taskState(task({ dueDate: '2026-11-20', originalDueDate: '2026-11-20' }), ev(0), today).status).toBe('planned');
    expect(taskState(task({ dueDate: '2026-11-08', originalDueDate: '2026-11-08' }), ev(0), today).status).toBe('due_soon');
    expect(taskState(task({ dueDate: '2026-11-09', originalDueDate: '2026-11-09' }), ev(0), today).status).toBe('planned');
  });

  it('is late the day after the due date, and severe from 7 days', () => {
    expect(taskState(task({ dueDate: '2026-11-01', originalDueDate: '2026-11-01' }), ev(0), today).status).toBe('due_soon');
    const s = taskState(task({ dueDate: '2026-10-31', originalDueDate: '2026-10-31' }), ev(0), today);
    expect(s).toMatchObject({ status: 'late', daysLate: 1, severe: false });
    expect(taskState(task({ dueDate: '2026-10-25', originalDueDate: '2026-10-25' }), ev(0), today)).toMatchObject({ status: 'late', daysLate: 7, severe: true });
  });

  it('is in progress when set by hand or when the records show part of the cattle; late still wins after the due date', () => {
    expect(taskState(task({ manualState: 'in_progress' }), ev(0), today).status).toBe('in_progress');
    const part = taskState(task(), ev(4), today);
    expect(part).toMatchObject({ status: 'in_progress', progress: 0.4 });
    expect(taskState(task({ dueDate: '2026-10-20', originalDueDate: '2026-10-20' }), ev(4), today)).toMatchObject({ status: 'late', progress: 0.4 });
  });

  it('is done when the records show everything, even after the due date', () => {
    expect(taskState(task({ dueDate: '2026-10-20', originalDueDate: '2026-10-20' }), ev(10), today)).toMatchObject({ status: 'done', progress: 1, byHand: false });
  });

  it('is done by hand until the records agree', () => {
    expect(taskState(task({ manualState: 'done_by_hand' }), ev(0), today)).toMatchObject({ status: 'done', byHand: true });
  });

  it('is postponed until the new date has passed, and remembers the delay', () => {
    const t = task({ manualState: 'postponed', dueDate: '2026-11-15', originalDueDate: '2026-11-05' });
    expect(taskState(t, ev(0), today)).toMatchObject({ status: 'postponed', delayDays: 10 });
    expect(taskState(t, ev(0), '2026-11-16')).toMatchObject({ status: 'late', daysLate: 1, delayDays: 10 });
  });

  it('is cancelled whatever else is true', () => {
    expect(taskState(task({ manualState: 'cancelled', dueDate: '2026-10-01', originalDueDate: '2026-10-01' }), ev(0), today).status).toBe('cancelled');
  });
});

describe('taskChangeProblem', () => {
  const t = task();
  const today = '2026-11-01';
  it('asks for a reason whenever the plan changes', () => {
    expect(taskChangeProblem(t, { action: 'postpone', newDueDate: '2026-11-20', reason: '' }, today)).toMatch(/why/);
    expect(taskChangeProblem(t, { action: 'postpone', newDueDate: '2026-11-20', reason: 'Truck broke' }, today)).toBeNull();
    expect(taskChangeProblem(t, { action: 'cancel', reason: 'no' }, today)).toMatch(/why/);
    expect(taskChangeProblem(t, { action: 'adjust', plannedHead: 8, reason: '' }, today)).toMatch(/why/);
    expect(taskChangeProblem(t, { action: 'adjust', plannedHead: 8, reason: 'Only 8 ready' }, today)).toBeNull();
    expect(taskChangeProblem(t, { action: 'done', note: '' }, today)).toMatch(/note/);
  });
  it('checks the values', () => {
    expect(taskChangeProblem(t, { action: 'postpone', newDueDate: '2026-10-01', reason: 'late truck' }, today)).toMatch(/past/);
    expect(taskChangeProblem(t, { action: 'postpone', newDueDate: t.dueDate, reason: 'same' }, today)).toMatch(/different/);
    expect(taskChangeProblem(t, { action: 'adjust', plannedHead: 0, reason: 'zero' }, today)).toMatch(/whole/);
    expect(taskChangeProblem(t, { action: 'done', note: 'Delivered by truck', doneOn: '2027-01-01' }, today)).toMatch(/future/);
    expect(taskChangeProblem(t, { action: 'reopen' }, today)).toMatch(/nothing/);
    expect(taskChangeProblem(task({ manualState: 'cancelled' }), { action: 'start' }, today)).toMatch(/Reopen/);
  });
});

describe('swaps and summary', () => {
  const buy = task({ id: 'B', kind: 'buy_back', cycleKey: 'c0', dueDate: '2026-11-05', originalDueDate: '2026-11-05', plannedHead: 10, plannedKg: 4500, plannedValue: 56_250_000 });
  const sell = task({ id: 'S', kind: 'sell_to_farm', cycleKey: 'c4', dueDate: '2026-11-05', originalDueDate: '2026-11-05', plannedHead: 10, plannedKg: 3000, plannedValue: 33_000_000 });
  const feed = task({ id: 'F', kind: 'buy_back', cycleKey: 'c1', dueDate: '2026-10-28', originalDueDate: '2026-10-28', plannedHead: 10, plannedKg: 4500, plannedValue: 56_250_000 });
  const today = '2026-11-06';
  const evidence = new Map<string, Evidence>([['B', { doneAmount: 10 }], ['S', { doneAmount: 4 }], ['F', { doneAmount: 0 }]]);
  const all = [buy, sell, feed];
  const states = new Map(all.map(t => [t.id, taskState(t, evidence.get(t.id), today)]));

  it('calls a swap open when only one side is done', () => {
    const list = swaps(all, t => states.get(t.id)!.status);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ date: '2026-11-05', state: 'open' });
    expect(swaps([buy, { ...sell }], () => 'done')[0].state).toBe('complete');
    expect(swaps([buy, sell], () => 'planned')[0].state).toBe('waiting');
  });

  it('counts tasks by status and kind, and lists the late ones most late first', () => {
    const s = summarize(all, states, evidence);
    expect(s.byStatus).toMatchObject({ done: 1, late: 2, planned: 0 });
    expect(s.byKind.buy_back).toMatchObject({ tasks: 2, done: 1, late: 1, plannedHead: 20, doneHead: 10 });
    expect(s.byKind.sell_to_farm).toMatchObject({ tasks: 1, late: 1, plannedHead: 10, doneHead: 4 });
    expect(s.lateTasks.map(l => l.task.id)).toEqual(['F', 'S']);
    expect(s.lateTasks[0]).toMatchObject({ daysLate: 9, severe: true });
    expect(s.swapsOpen).toBe(1);
  });

  it('leaves cancelled tasks out of the totals', () => {
    const c = { ...sell, manualState: 'cancelled' as const };
    const st = new Map([...states, ['S', taskState(c, evidence.get('S'), today)]]);
    const s = summarize([buy, c, feed], st, evidence);
    expect(s.byStatus.cancelled).toBe(1);
    expect(s.byKind.sell_to_farm.tasks).toBe(0);
  });
});
