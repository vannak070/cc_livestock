import { describe, expect, it } from 'vitest';
import { cowTrail, filterTrails } from './camcow-trail';
import type { Holding } from './camcow-stock';

const today = '2026-10-16';
const base = { sourceFarm: 'A', batchId: 'B-1', collectedOn: '2026-09-01', collectionWeight: 400, collectionTotal: 5_200_000, note: '' };
const held: Holding = { ...base, cowId: 'H1', status: 'Held' };
const sold: Holding = { ...base, cowId: 'S1', status: 'Sold', soldOn: '2026-09-11', buyer: 'Meat Co', buyerId: 'B1', saleWeight: 410, salePricePerKg: 13_200, saleTotal: 5_412_000 };
const lost: Holding = { ...base, cowId: 'L1', status: 'Lost', lostOn: '2026-09-04', note: 'Died' };

describe('one animal\'s trail', () => {
  it('counts days to today while held, to the sale once sold, and to the loss once lost', () => {
    expect(cowTrail(held, today).daysHeld).toBe(45);
    expect(cowTrail(sold, today).daysHeld).toBe(10);
    expect(cowTrail(lost, today).daysHeld).toBe(3);
  });
  it('works out the price a kg, the weight change and the margin of a sale', () => {
    const t = cowTrail(sold, today);
    expect(t).toMatchObject({ collectionPerKg: 13_000, weightChange: 10, margin: 212_000, marginPerKg: 517 });
    expect(cowTrail(held, today).margin).toBeUndefined();
  });
  it('takes the holding costs off the margin', () => {
    expect(cowTrail(sold, today, 60_000)).toMatchObject({ holdingCost: 60_000, margin: 212_000, marginAfterCosts: 152_000 });
    expect(cowTrail(held, today, 30_000)).toMatchObject({ holdingCost: 30_000 });
    expect(cowTrail(lost, today, 10_000).marginAfterCosts).toBe(-5_210_000);
  });
  it('shows a lost animal as a loss of what was paid for it', () => {
    expect(cowTrail(lost, today)).toMatchObject({ margin: -5_200_000, lostOn: '2026-09-04', note: 'Died' });
  });
});

describe('filtering the cattle list', () => {
  const all = [cowTrail(held, today), cowTrail(sold, today), cowTrail(lost, today)];
  it('filters by status and search', () => {
    expect(filterTrails(all, { status: 'Held', search: '' }).map(t => t.cowId)).toEqual(['H1']);
    expect(filterTrails(all, { status: 'Sold', search: '' }).map(t => t.cowId)).toEqual(['S1']);
    expect(filterTrails(all, { status: 'all', search: ' meat' }).map(t => t.cowId)).toEqual(['S1']);
    expect(filterTrails(all, { status: 'all', search: 'l1' }).map(t => t.cowId)).toEqual(['L1']);
  });
  it('can be limited to a fixed set of animals', () => {
    expect(filterTrails(all, { status: 'all', search: '', only: new Set(['H1', 'L1']) }).map(t => t.cowId)).toEqual(['H1', 'L1']);
  });
});
