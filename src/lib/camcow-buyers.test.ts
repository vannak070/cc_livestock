import { describe, expect, it } from 'vitest';
import { buyerAccounts, buyerProblem, summarizeBuyers, type Buyer } from './camcow-buyers';
import type { Holding } from './camcow-stock';

const buyer = (id: string, name: string): Buyer => ({ id, name, kind: 'trader', phone: '', location: '', note: '', active: true });
const sold = (cowId: string, buyerId: string, soldOn: string, kg: number, total: number): Holding => ({ cowId, sourceFarm: 'A', collectedOn: '2026-08-01', collectionWeight: 400, collectionTotal: 4_000_000, status: 'Sold', soldOn, buyer: buyerId, buyerId, saleWeight: kg, saleTotal: total, note: '' });

describe('buyer accounts', () => {
  const holdings = [sold('1', 'B1', '2026-08-20', 400, 5_200_000), sold('2', 'B1', '2026-08-20', 410, 5_330_000), sold('3', 'B1', '2026-10-10', 420, 5_460_000), sold('4', 'B2', '2026-10-01', 400, 4_800_000)];
  const buyers = [buyer('B1', 'Meat Co'), buyer('B2', 'Traders'), buyer('B3', 'New buyer')];

  it('adds up what each buyer bought, by day, newest sale first', () => {
    const a = buyerAccounts(holdings, buyers).find(x => x.buyer.id === 'B1')!;
    expect(a).toMatchObject({ head: 3, kg: 1230, sold: 15_990_000, perKg: 13_000, margin: 3_990_000, lastSaleOn: '2026-10-10' });
    expect(a.sales.map(s => [s.soldOn, s.head, s.cowIds])).toEqual([['2026-10-10', 1, ['3']], ['2026-08-20', 2, ['1', '2']]]);
  });
  it('lists buyers with nothing sold yet, with the biggest buyer first', () => {
    const all = buyerAccounts(holdings, buyers);
    expect(all.map(x => x.buyer.id)).toEqual(['B1', 'B2', 'B3']);
    expect(all[2]).toMatchObject({ sold: 0, head: 0, perKg: 0, sales: [] });
    expect(summarizeBuyers(all)).toMatchObject({ buyers: 3, head: 4, sold: 20_790_000 });
  });
  it('ignores animals that are lost or still held', () => {
    const lost = { ...sold('9', 'B1', '2026-10-01', 0, 0), status: 'Lost' as const, saleTotal: undefined };
    expect(buyerAccounts([lost], buyers).find(x => x.buyer.id === 'B1')).toMatchObject({ sold: 0, head: 0 });
  });
});

describe('buyer checks', () => {
  it('needs a name that is not used by another buyer', () => {
    expect(buyerProblem({ name: 'Meat Co', kind: 'trader' }, [])).toBeNull();
    expect(buyerProblem({ name: ' ', kind: 'trader' }, [])).toMatch(/name/);
    expect(buyerProblem({ name: 'meat co', kind: 'trader' }, ['Meat Co'])).toMatch(/already/);
    expect(buyerProblem({ name: 'X', kind: 'bad' as never }, [])).toMatch(/kind/);
  });
});
