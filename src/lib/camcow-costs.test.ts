import { describe, expect, it } from 'vitest';
import { costProblem, shareCosts, summarizeCosts, type StockCost } from './camcow-costs';
import type { Holding } from './camcow-stock';

const h = (cowId: string, collectedOn: string, extra: Partial<Holding> = {}): Holding => ({ cowId, sourceFarm: 'A', collectedOn, collectionWeight: 400, collectionTotal: 5_000_000, status: 'Held', note: '', ...extra });
const cost = (id: string, date: string, amount: number, kind: StockCost['kind'] = 'feed'): StockCost => ({ id, date, kind, amount, note: '' });

describe('sharing costs between the animals in stock', () => {
  const holdings = [
    h('1', '2026-10-01'),
    h('2', '2026-10-05'),
    h('3', '2026-10-01', { status: 'Sold', soldOn: '2026-10-06' }),
    h('4', '2026-10-01', { status: 'Lost', lostOn: '2026-10-03' }),
  ];
  it('splits a cost evenly over the animals in stock that day, sale and loss days included', () => {
    const s = shareCosts(holdings, [cost('a', '2026-10-06', 300_000)]);
    // On 10-06: 1, 2 and 3 (sold that day) are in stock; 4 was lost on 10-03.
    expect([...s.perCow.entries()]).toEqual([['1', 100_000], ['2', 100_000], ['3', 100_000]]);
    expect(s).toMatchObject({ notShared: 0, total: 300_000 });
  });
  it('adds up an animal\'s share over several costs', () => {
    const s = shareCosts(holdings, [cost('a', '2026-10-02', 300_000), cost('b', '2026-10-05', 200_000)]);
    // 10-02: 1, 3, 4 -> 100,000 each. 10-05: 1, 2, 3 -> 66,666.67 each.
    expect(s.perCow.get('4')).toBe(100_000);
    expect(Math.round(s.perCow.get('1')!)).toBe(166_667);
    expect(s.perCow.has('2')).toBe(true);
  });
  it('keeps a cost on a day with nothing in stock apart', () => {
    const s = shareCosts(holdings, [cost('a', '2026-09-20', 50_000)]);
    expect(s).toMatchObject({ notShared: 50_000, total: 50_000 });
    expect(s.perCow.size).toBe(0);
  });
});

describe('cost summary', () => {
  it('totals by kind for the months asked, with a head a day', () => {
    const holdings = [h('1', '2026-10-01'), h('2', '2026-10-01')];
    const s = summarizeCosts([cost('a', '2026-10-05', 200_000, 'feed'), cost('b', '2026-10-06', 100_000, 'labour'), cost('c', '2026-09-30', 999, 'other')], holdings, '2026-10', '2026-10');
    expect(s.total).toBe(300_000);
    expect(s.byKind).toMatchObject({ feed: 200_000, labour: 100_000, other: 0 });
    expect(s.perHeadPerDay).toBe(75_000);
  });
});

describe('cost checks', () => {
  const ok = { date: '2026-10-10', kind: 'feed' as const, amount: 150_000 };
  it('accepts a good cost and names what is wrong', () => {
    expect(costProblem(ok, '2026-10-16')).toBeNull();
    expect(costProblem({ ...ok, date: '2026-10-20' }, '2026-10-16')).toMatch(/future/);
    expect(costProblem({ ...ok, kind: 'x' as never }, '2026-10-16')).toMatch(/for/);
    expect(costProblem({ ...ok, amount: 0 }, '2026-10-16')).toMatch(/amount/);
    expect(costProblem({ ...ok, amount: 1.5 }, '2026-10-16')).toMatch(/amount/);
    expect(costProblem({ ...ok, date: 'x' }, '2026-10-16')).toMatch(/day/);
  });
});
