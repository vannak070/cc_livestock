import { describe, expect, it } from 'vitest';
import { countByStatus, daysUntil, finishedTasks, planPricesByFarm, plansInUse, recordsOfFarm, taskViews, todayCounts, todoGroups, type TaskView } from './ops-view';
import type { Task } from './ops-program';
import type { StockItem, SalesRecord } from './xlsx-parser';

const cow = (id: string, location: string, purchaseDate: string): StockItem => ({ id, location, purchaseDate, status: 'Active', weight: 300 } as unknown as StockItem);
const sale = (cowId: string, salesDate: string, weight = 400, totalPrice = 5_000_000): SalesRecord => ({ cowId, salesDate, weight, totalPrice } as unknown as SalesRecord);
const task = (over: Partial<Task>): Task => ({
  id: 'T1', programId: 'P1', kind: 'sell_to_farm', cycleKey: 'c0', product: '', dueDate: '2026-10-10', originalDueDate: '2026-10-10', plannedHead: 2, plannedKg: 600,
  reason: '', owner: '', notes: '', updatedBy: '', updatedAt: '', ...over,
});

describe('recordsOfFarm', () => {
  const stock = [cow('A', 'SNR Farm', '2026-10-09T05:00:00Z'), cow('B', 'Other', '2026-10-09T05:00:00Z')];
  it('keeps only this farm\'s registrations and sales', () => {
    const r = recordsOfFarm('SNR Farm', stock, [sale('A', '2026-10-12T05:00:00Z'), sale('B', '2026-10-12T05:00:00Z')]);
    expect(r.registrations).toHaveLength(1);
    expect(r.sales).toEqual([{ date: '2026-10-12', farm: 'SNR Farm', kg: 400, value: 5_000_000 }]);
  });

  it('does not count a calf born on the farm as cattle sold to it', () => {
    const born = { ...cow('C', 'SNR Farm', '2026-10-09T05:00:00Z'), purchaseType: 'Born in Farm' } as StockItem;
    expect(recordsOfFarm('SNR Farm', [...stock, born], []).registrations).toHaveLength(1);
  });

  it('counts sales to CC Livestock, to nobody named, or to the old default, but not a sale to another named buyer', () => {
    const buyers = ['CC Livestock', '', 'Local Market', 'Sok Trader'];
    const stockB = buyers.map((_, i) => cow(`X${i}`, 'SNR Farm', '2026-10-09T05:00:00Z'));
    const sales = buyers.map((buyer, i) => ({ ...sale(`X${i}`, '2026-10-12T05:00:00Z'), buyer }) as SalesRecord);
    expect(recordsOfFarm('SNR Farm', stockB, sales).sales).toHaveLength(3);
  });
});

describe('taskViews', () => {
  const stock = [cow('A', 'SNR Farm', '2026-10-09T05:00:00Z')];
  const programs = new Map([['P1', 'SNR Farm'], ['P2', 'Other']]);
  it('shows a sale to the farm as in progress when only part of the cattle are registered, and late after the date', () => {
    const [v] = taskViews([task({})], programs, stock, [], '2026-10-09');
    expect(v.state).toMatchObject({ status: 'in_progress', progress: 0.5 });
    expect(taskViews([task({})], programs, stock, [], '2026-10-20')[0].state.status).toBe('late');
  });
  it('is done when all the cattle are registered, and counts statuses', () => {
    const both = [cow('A', 'SNR Farm', '2026-10-09T05:00:00Z'), cow('C', 'SNR Farm', '2026-10-10T05:00:00Z')];
    const views = taskViews([task({}), task({ id: 'T2', programId: 'P2' })], programs, both, [], '2026-10-20');
    expect(views.find(v => v.task.id === 'T1')!.state.status).toBe('done');
    expect(countByStatus(views)).toMatchObject({ done: 1, late: 1, open: 1, all: 2 });
  });
  it('leaves out a task whose program is unknown', () => {
    expect(taskViews([task({ programId: 'P9' })], programs, stock, [], '2026-10-20')).toEqual([]);
  });
});

describe('management helpers', () => {
  const programs = [{ id: 'P1', farm: 'SNR Farm', planName: 'Plan 1', status: 'Active' }, { id: 'P2', farm: 'Other', planName: 'Plan 2', status: 'Active' }, { id: 'P3', farm: 'Old', planName: 'Plan 3', status: 'Closed' }];
  const stock = [cow('A', 'SNR Farm', '2026-10-09T05:00:00Z'), cow('C', 'SNR Farm', '2026-10-10T05:00:00Z')];
  const farmOf = new Map([['P1', 'SNR Farm'], ['P2', 'Other']]);
  const tasks = [
    task({ id: 'T1' }),                                                                            // sold 2 of 2 -> done
    task({ id: 'T2', cycleKey: 'c1', dueDate: '2026-10-12', originalDueDate: '2026-10-12', plannedHead: 5 }), // none registered after -> late on 20 Oct
    task({ id: 'T3', cycleKey: 'c2', dueDate: '2026-11-30', originalDueDate: '2026-11-30' }),         // planned
    task({ id: 'T4', programId: 'P2', manualState: 'postponed', dueDate: '2026-10-25', originalDueDate: '2026-10-15' }),
    task({ id: 'T5', programId: 'P2', cycleKey: 'c9', manualState: 'cancelled' }),
  ];
  const views = taskViews(tasks, farmOf, stock, [], '2026-10-20');

  it('counts each program\'s tasks, leaves cancelled ones out and puts the farm with late tasks first', async () => {
    const { farmRows } = await import('./ops-view');
    const rows = farmRows(views, programs);
    expect(rows.map(r => r.farm)).toEqual(['SNR Farm', 'Other']);
    expect(rows[0]).toMatchObject({ total: 3, late: 1, done: 1, next: { dueDate: '2026-10-12', late: true } });
    expect(rows[1]).toMatchObject({ total: 1, late: 0 });
  });

  it('groups tasks by due month, and measures completion of what was due', async () => {
    const { monthBars, completion } = await import('./ops-view');
    expect(monthBars(views).map(b => [b.month, b.total])).toEqual([['2026-10', 3], ['2026-11', 1]]);
    expect(completion(views, '2026-10-20')).toEqual({ dueToDate: 2, doneToDate: 1, pct: 50 });
    expect(completion([], '2026-10-20').pct).toBe(100);
  });

  it('lists late tasks most late first, and delayed ones', async () => {
    const { attention } = await import('./ops-view');
    const a = attention(views);
    expect(a.late.map(v => v.task.id)).toEqual(['T2']);
    expect(a.delayed.map(v => v.task.id)).toEqual(['T4']);
  });
});

describe('buildPlanBlock', () => {
  const programs = [{ id: 'P1', farm: 'SNR Farm', planName: 'Plan 1', status: 'Active' }, { id: 'P2', farm: 'Other', planName: 'Plan 2', status: 'Active' }];
  const farmOf = new Map([['P1', 'SNR Farm'], ['P2', 'Other']]);
  const stock = [cow('A', 'SNR Farm', '2026-10-09T05:00:00Z'), cow('C', 'SNR Farm', '2026-10-10T05:00:00Z')];
  const tasks = [
    task({ id: 'T1', plannedValue: 33_000_000 }),                                                          // sold to the farm, done
    task({ id: 'T2', kind: 'buy_back', cycleKey: 'b:B1', dueDate: '2026-10-12', originalDueDate: '2026-10-12', plannedHead: 5, plannedKg: 2000, plannedValue: 25_000_000 }), // late
    task({ id: 'T3', kind: 'buy_back', cycleKey: 'c1', dueDate: '2026-11-05', originalDueDate: '2026-11-05', plannedHead: 4, plannedKg: 1800, plannedValue: 22_500_000 }), // within 30 days
    task({ id: 'T4', programId: 'P2', cycleKey: 'c3', dueDate: '2026-10-25', originalDueDate: '2026-10-25', plannedHead: 3, plannedKg: 900, plannedValue: 10_000_000 }), // sold to the other farm, not registered yet
    task({ id: 'T5', cycleKey: 'c9', dueDate: '2027-03-05', originalDueDate: '2027-03-05', plannedValue: 40_000_000 }), // far away
  ];
  const views = taskViews(tasks, farmOf, stock, [], '2026-10-20');

  it('is null when no farm has a program', async () => {
    const { buildPlanBlock } = await import('./ops-view');
    expect(buildPlanBlock([], [], '2026-10', '2026-10-20')).toBeNull();
    expect(buildPlanBlock(views, [{ id: 'P1', farm: 'x', planName: 'p', status: 'Closed' }], '2026-10', '2026-10-20')).toBeNull();
  });

  it('counts the month\'s tasks by status and kind, and the planned money for the next 30 days that is not done', async () => {
    const { buildPlanBlock } = await import('./ops-view');
    const b = buildPlanBlock(views, programs, '2026-10', '2026-10-20')!;
    expect(b.farms).toBe(2);
    expect(b.byStatus).toMatchObject({ done: 1, late: 1, in_progress: 0 });
    expect(b.byKind.sell_to_farm).toMatchObject({ tasks: 2, done: 1, plannedHead: 5, doneHead: 2 });
    expect(b.byKind.buy_back).toMatchObject({ tasks: 1, late: 1, plannedHead: 5 });
    // not done and due by 19 Nov: the late buy-back (25M) and the 5 Nov buy-back (22.5M); the sale to the farm in March is far off
    expect(b.cashOut30).toBe(47_500_000);
    expect(b.cashIn30).toBe(10_000_000); // the 25 Oct sale to the other farm; the March one is far off
    expect(b.late).toEqual([{ farm: 'SNR Farm', kind: 'buy_back', dueDate: '2026-10-12', daysLate: 8, owner: '' }]);
    expect(b.next[0]).toMatchObject({ kind: 'buy_back', dueDate: '2026-10-12', late: true });
  });
});

describe('the operations work list', () => {
  const today = '2026-10-14';
  const view = (id: string, status: TaskView['state']['status'], dueDate: string, extra: Partial<TaskView['state']> = {}, kind: Task['kind'] = 'sell_to_farm'): TaskView => ({
    task: task({ id, dueDate, kind, programId: 'P1' }),
    state: { status, daysLate: status === 'late' ? daysUntil(today, dueDate) : 0, delayDays: 0, progress: 0, byHand: false, severe: false, ...extra },
    evidence: { doneAmount: 0 },
  });

  it('counts days between two days, past ones negative', () => {
    expect(daysUntil('2026-10-20', today)).toBe(6);
    expect(daysUntil('2026-10-14', today)).toBe(0);
    expect(daysUntil('2026-09-24', today)).toBe(-20);
  });

  it('puts late tasks first (the most overdue on top), then this week, then later', () => {
    const g = todoGroups([
      view('later', 'planned', '2026-11-20'),
      view('soon', 'due_soon', '2026-10-17'),
      view('late-new', 'late', '2026-10-12'),
      view('late-old', 'late', '2026-09-24'),
      view('today', 'due_soon', '2026-10-14'),
    ], today);
    expect(g.late.map(v => v.task.id)).toEqual(['late-old', 'late-new']);
    expect(g.week.map(v => v.task.id)).toEqual(['today', 'soon']);
    expect(g.later.map(v => v.task.id)).toEqual(['later']);
  });

  it('looks 14 days ahead by default, and as far as asked', () => {
    const list = [view('d10', 'planned', '2026-10-24'), view('d20', 'planned', '2026-11-03')];
    expect(todoGroups(list, today).week.map(v => v.task.id)).toEqual(['d10']);
    expect(todoGroups(list, today, 7).week).toEqual([]);
    expect(todoGroups(list, today, 7).later.map(v => v.task.id)).toEqual(['d10', 'd20']);
  });

  it('keeps a task that is being worked in this week even when it is due later, and a postponed one where its new date puts it', () => {
    const g = todoGroups([view('busy', 'in_progress', '2026-12-01'), view('moved', 'postponed', '2026-10-30'), view('moved-soon', 'postponed', '2026-10-18')], today);
    expect(g.week.map(v => v.task.id).sort()).toEqual(['busy', 'moved-soon']);
    expect(g.later.map(v => v.task.id)).toEqual(['moved']);
  });

  it('leaves finished and cancelled tasks out of the work list', () => {
    const g = todoGroups([view('d', 'done', '2026-10-01'), view('c', 'cancelled', '2026-10-15'), view('p', 'planned', '2026-10-15')], today);
    expect([...g.late, ...g.week, ...g.later].map(v => v.task.id)).toEqual(['p']);
  });

  it('lists finished tasks newest first, only the last 30 days unless asked for all', () => {
    const list = [view('old', 'done', '2026-08-01'), view('mid', 'done', '2026-09-20'), view('cancelled', 'cancelled', '2026-10-10'), view('open', 'planned', '2026-10-20')];
    expect(finishedTasks(list, today).map(v => v.task.id)).toEqual(['cancelled', 'mid']);
    expect(finishedTasks(list, today, 0).map(v => v.task.id)).toEqual(['cancelled', 'mid', 'old']);
  });

  it('counts what Today says: late tasks, tasks due this week, and the farms with late tasks', () => {
    const farmOf = new Map([['P1', 'CC_001'], ['P2', 'SNR Farm']]);
    const late2 = { ...view('l2', 'late', '2026-10-01'), task: task({ id: 'l2', programId: 'P2', dueDate: '2026-10-01' }) };
    expect(todayCounts([view('l1', 'late', '2026-10-02'), late2, view('w', 'planned', '2026-10-16'), view('x', 'planned', '2026-12-16')], farmOf, today)).toEqual({ late: 2, week: 1, lateFarms: ['CC_001', 'SNR Farm'] });
  });
});

describe('plansInUse', () => {
  it('lists the farms using each Planning plan, leaving out closed programs', () => {
    const used = plansInUse([
      { farm: 'SNR Farm', planSlot: 3, status: 'Active' },
      { farm: 'CC_001', planSlot: 3, status: 'Paused' },
      { farm: 'Old Farm', planSlot: 3, status: 'Closed' },
      { farm: 'Sunny', planSlot: 1, status: 'Active' },
    ]);
    expect(used.get(3)).toEqual(['CC_001', 'SNR Farm']);
    expect(used.get(1)).toEqual(['Sunny']);
    expect(used.has(2)).toBe(false);
  });
});

describe('planPricesByFarm', () => {
  it("gives each open program's buy-back price: its own override, else the Planning plan's selling price", () => {
    const m = planPricesByFarm([
      { farm: 'A', status: 'Active', buybackPricePerKg: 12_000, plan: { sellingPricePerKgKhr: 11_000 } },
      { farm: 'B', status: 'Paused', plan: { sellingPricePerKgKhr: 11_500 } },
      { farm: 'C', status: 'Closed', plan: { sellingPricePerKgKhr: 9_000 } },
      { farm: 'D', status: 'Active' },
    ]);
    expect([...m]).toEqual([['A', 12_000], ['B', 11_500]]);
  });
});
