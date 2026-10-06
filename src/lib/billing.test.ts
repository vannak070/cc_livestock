import { describe, expect, it } from 'vitest';
import { billingProblem, billingStart, canSeeBilling, monthStatement, priceForMonth, recentMonths, shiftMonth, withPrice, withoutPrice } from './billing';
import type { BillingSettings, CattleRegistration } from './types';

const reg = (cowId: string, farm: string, month: string, over: Partial<CattleRegistration> = {}): CattleRegistration =>
  ({ cowId, farm, month, registeredAt: `${month}-10T03:00:00.000Z`, registeredBy: 'M', ...over });
const prices: BillingSettings = { prices: [{ from: '2026-10', price: 5000 }, { from: '2027-01', price: 6000 }] };

describe('prices', () => {
  it('starts billing at the first price month and uses the latest rule that has started', () => {
    expect(billingStart(prices)).toBe('2026-10');
    expect(priceForMonth(prices, '2026-09')).toBeUndefined();
    expect(priceForMonth(prices, '2026-10')).toBe(5000);
    expect(priceForMonth(prices, '2026-12')).toBe(5000);
    expect(priceForMonth(prices, '2027-01')).toBe(6000);
    expect(priceForMonth(undefined, '2026-10')).toBeUndefined();
    expect(billingStart({ prices: [] })).toBeUndefined();
  });

  it('adds, replaces and removes price rules', () => {
    expect(withPrice(prices, { from: '2026-10', price: 4000 }).prices).toEqual([{ from: '2026-10', price: 4000 }, { from: '2027-01', price: 6000 }]);
    expect(withPrice(undefined, { from: '2026-10', price: 5000 }).prices).toHaveLength(1);
    expect(withoutPrice(prices, '2027-01').prices).toEqual([{ from: '2026-10', price: 5000 }]);
  });

  it('validates the list', () => {
    expect(billingProblem(prices)).toBeNull();
    expect(billingProblem({ prices: [] })).toMatch(/Add a price/);
    expect(billingProblem({ prices: [{ from: '2026-13', price: 5000 }] })).toMatch(/month the price starts/);
    expect(billingProblem({ prices: [{ from: '2026-10', price: -1 }] })).toMatch(/whole number/);
    expect(billingProblem({ prices: [{ from: '2026-10', price: 5000.5 }] })).toMatch(/whole number/);
    expect(billingProblem({ prices: [{ from: '2026-10', price: 1 }, { from: '2026-10', price: 2 }] })).toMatch(/same month/);
  });

  it('is for Super Admin and Admin only', () => {
    expect(canSeeBilling({ role: 'Super Admin' })).toBe(true);
    expect(canSeeBilling({ role: 'Admin' })).toBe(true);
    for (const role of ['Company', 'Management', 'Farm Owner', 'Farm Staff', 'Veterinarian']) expect(canSeeBilling({ role })).toBe(false);
    expect(canSeeBilling(null)).toBe(false);
  });
});

describe('monthStatement', () => {
  const regs = [
    reg('A1', 'SNR Farm', '2026-10'), reg('A2', 'SNR Farm', '2026-10'), reg('B1', 'Sokchea', '2026-10'),
    reg('X1', 'SNR Farm', '2026-10', { removedAt: '2026-10-11T00:00:00Z', removedBy: 'Admin' }),
    reg('C1', 'SNR Farm', '2026-09'), reg('D1', 'Sokchea', '2027-01'),
  ];

  it('bills each registered animal once, in its month, at that month\'s price, per farm', () => {
    const s = monthStatement('2026-10', regs, prices);
    expect(s).toMatchObject({ billed: true, price: 5000, cattle: 3, amount: 15000, removed: 1 });
    expect(s.farms).toEqual([{ farm: 'SNR Farm', cattle: 2, amount: 10000 }, { farm: 'Sokchea', cattle: 1, amount: 5000 }]);
    expect(s.animals.map(a => a.cowId).sort()).toEqual(['A1', 'A2', 'B1']);
    expect(monthStatement('2027-01', regs, prices)).toMatchObject({ price: 6000, cattle: 1, amount: 6000 });
  });

  it('does not bill months before billing starts (but still lists nothing as billed)', () => {
    const s = monthStatement('2026-09', regs, prices);
    expect(s).toMatchObject({ billed: false, cattle: 0, amount: 0 });
  });

  it('does not bill a removed-by-mistake registration', () => {
    const only = [reg('X1', 'SNR Farm', '2026-10', { removedAt: '2026-10-11T00:00:00Z' })];
    expect(monthStatement('2026-10', only, prices)).toMatchObject({ cattle: 0, amount: 0, removed: 1 });
  });

  it('is empty, not an error, when nothing was registered or no price is set', () => {
    expect(monthStatement('2026-11', regs, prices)).toMatchObject({ billed: true, cattle: 0, amount: 0, farms: [] });
    expect(monthStatement('2026-10', regs, undefined)).toMatchObject({ billed: false });
  });
});

describe('months', () => {
  it('lists the last months newest first across a year end and shifts months', () => {
    const regs = [reg('A1', 'F', '2026-12'), reg('A2', 'F', '2026-12'), reg('A3', 'F', '2027-01')];
    const list = recentMonths('2027-01', 3, regs, { prices: [{ from: '2026-11', price: 5000 }] });
    expect(list.map(m => [m.month, m.cattle, m.amount])).toEqual([['2027-01', 1, 5000], ['2026-12', 2, 10000], ['2026-11', 0, 0]]);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -10)).toBe('2025-12');
  });
});
