import { describe, expect, it } from 'vitest';
import { buildControlDashboard } from './control-dashboard';

const cow = (id: string, location: string, extra: Record<string, unknown> = {}) => ({ id, location, status: 'Active', weight: 300, purchaseDate: '2026-10-02', ...extra });
const batch = (id: string, farm: string, ids: string[], target: string, price?: number) => ({ id, name: `Batch ${id}`, status: 'Active', farmLocation: farm, startDate: '2026-06-01', cowIds: ids, sellingTargetDate: target, expectedSellingPrice: price });
const build = (over: Record<string, unknown> = {}) => buildControlDashboard({
  farms: [{ id: 'F1', name: 'Farm A' }, { id: 'F2', name: 'Farm B' }],
  stock: [cow('A1', 'Farm A'), cow('A2', 'Farm A'), cow('B1', 'Farm B', { weight: 0 }), cow('S1', 'Farm B', { status: 'Sold' })],
  batches: [batch('X', 'Farm A', ['A1', 'A2'], '2026-10-10', 10000), batch('Y', 'Farm B', ['B1'], '2026-10-20')],
  sales: [{ cowId: 'S1', salesDate: '2026-10-03T03:00:00Z', weight: 280, totalPrice: 3000000 }],
  contracts: [{ batchId: 'X', contractNo: 'C-1', buybackPricePerKg: 12000 }],
  month: '2026-10', today: '2026-10-14',
  ...over,
} as never);

describe('buildControlDashboard', () => {
  it('counts cattle with the farms, delivered and bought back', () => {
    const d = build();
    expect(d.inventory).toMatchObject({ delivered: 4, withFarmers: 3, boughtBack: 1, soldToBuyers: null, heldByCamcow: null, missing: 1 });
  });

  it('fills what CC Livestock holds and has sold on when its stock is tracked, and raises the unsold alert for cattle held too long', () => {
    const d = build({ camcow: { held: 58, sold: 165, heldTooLong: 25 } });
    expect(d.inventory).toMatchObject({ heldByCamcow: 58, soldToBuyers: 165 });
    expect(d.alerts.find(a => a.key === 'unsold')).toEqual({ key: 'unsold', level: 'amber', value: 25 });
    expect(build({ camcow: { held: 3, sold: 0, heldTooLong: 0 } }).alerts.find(a => a.key === 'unsold')).toMatchObject({ level: 'green', value: 0 });
  });

  it('puts buy-backs into overdue and due-soon groups, and values them at the contract price', () => {
    const d = build();
    expect(d.inventory.overdue).toBe(2); // Batch X was due 10-10, today is 10-14
    expect(d.inventory.due30).toBe(1);   // Batch Y is 6 days away, so it counts in 7, 30 and 60
    expect(d.inventory.due7).toBe(1);
    expect(d.buyback.contractValue).toBe(600 * 12000); // two cows of 300 kg at the contract price
    expect(d.buyback.noPriceHead).toBe(1); // Batch Y has no price at all
  });

  it('shows the money the app does not record as unknown, never as zero', () => {
    const d = build();
    expect(d.buyback).toMatchObject({ paymentsRegister: null, paymentsCash: null, cash30All: null });
    expect(d.alerts.filter(a => a.level === 'grey').map(a => a.key)).toEqual(['cash', 'unsold', 'bank', 'tasks']); // 'tasks' is grey while no farm has a program
  });

  it('lights the alerts', () => {
    const levels = Object.fromEntries(build().alerts.map(a => [a.key, a.level]));
    expect(levels).toMatchObject({ overdue: 'red', due7: 'amber', missing: 'amber', integrity: 'green' });
  });

  it('counts movement by month over twelve months ending with the month shown', () => {
    const d = build();
    expect(d.movement).toHaveLength(12);
    expect(d.movement.at(-1)).toEqual({ month: '2026-10', delivered: 4, boughtBack: 1 });
    expect(d.movement[0].month).toBe('2025-11');
  });

  it('narrows everything to one farm', () => {
    const d = build({ farm: 'Farm B' });
    expect(d.inventory).toMatchObject({ delivered: 2, withFarmers: 1, boughtBack: 1, overdue: 0 });
    expect(d.farmers.map(f => f.name)).toEqual(['Farm B']);
    expect(d.upcoming.map(u => u.batch)).toEqual(['Batch Y']);
  });

  it('lists farms by cattle with the farmer, and upcoming buy-backs soonest first', () => {
    const d = build();
    expect(d.farmers[0]).toMatchObject({ name: 'Farm A', id: 'F1', withFarmer: 2, overdue: 2 });
    expect(d.upcoming.map(u => u.batch)).toEqual(['Batch X', 'Batch Y']);
    expect(d.upcoming[0]).toMatchObject({ days: -4, bucket: 'overdue', estimate: false });
  });

  it("values a batch with no price of its own at the farm's plan price, but counts only contract-priced batches as contractual", () => {
    const ops = { views: [], programs: [{ id: 'P1', farm: 'Farm B', planName: 'Plan 2', status: 'Active', plan: { sellingPricePerKgKhr: 11_000 } }] };
    const d = build({ ops, stock: [cow('A1', 'Farm A'), cow('A2', 'Farm A'), cow('B1', 'Farm B'), cow('S1', 'Farm B', { status: 'Sold' })] });
    expect(d.upcoming.find(u => u.batch === 'Batch Y')).toMatchObject({ value: 300 * 11_000, estimate: true });
    expect(d.buyback.noPriceHead).toBe(0);
    expect(d.buyback.remaining).toBe(600 * 12_000 + 300 * 11_000);
    expect(d.buyback.contractValue).toBe(600 * 12_000);
  });

  it('stops the period at today in the current month and at month end in a past month', () => {
    expect(build().periodEnd).toBe('2026-10-14');
    expect(build({ month: '2026-09' }).periodEnd).toBe('2026-09-30');
  });

  describe('the action plan block', () => {
    const programs = [{ id: 'P1', farm: 'Farm A', planName: 'Plan 1', status: 'Active' }];
    const task = (over: Record<string, unknown>) => ({ id: 'T', programId: 'P1', kind: 'buy_back', cycleKey: 'b:X', product: '', dueDate: '2026-10-10', originalDueDate: '2026-10-10', plannedHead: 2, plannedKg: 600, plannedValue: 7_200_000, reason: '', owner: '', notes: '', updatedBy: '', updatedAt: '', ...over });
    const view = (t: Record<string, unknown>, status: string, daysLate = 0) => ({ task: t, evidence: { doneAmount: 0 }, state: { status, daysLate, delayDays: 0, progress: 0, byHand: false, severe: daysLate >= 7 } });

    it('is null when no farm has a program, and the tasks alert is grey', () => {
      const d = build();
      expect(d.plan).toBeNull();
      expect(d.alerts.find(a => a.key === 'tasks')).toMatchObject({ level: 'grey', value: null });
    });

    it('reports the plan\'s tasks, and turns the tasks alert red when one is late', () => {
      const late = view(task({ id: 'T1' }), 'late', 4);
      const done = view(task({ id: 'T2', kind: 'sell_to_farm', cycleKey: 'c0', plannedHead: 3, plannedKg: 900, dueDate: '2026-10-05', originalDueDate: '2026-10-05' }), 'done');
      const d = build({ ops: { views: [late, done], programs } });
      expect(d.plan).toMatchObject({ farms: 1, byStatus: { late: 1, done: 1 }, cashOut30: 7_200_000, late: [{ farm: 'Farm A', kind: 'buy_back', daysLate: 4 }] });
      expect(d.alerts.find(a => a.key === 'tasks')).toMatchObject({ level: 'red', value: 1 });
    });

    it('leaves out the programs of other farms when one farm is chosen', () => {
      const d = build({ farm: 'Farm B', ops: { views: [view(task({}), 'late', 4)], programs } });
      expect(d.plan).toBeNull();
    });
  });
});
