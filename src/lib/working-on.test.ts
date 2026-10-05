import { describe, it, expect } from 'vitest';
import { validFocus } from './working-on';
import { scopeDataToFarm } from './farm-view';
import { scopeDataForActor } from './data-scope';
import type { ERPLivestockData } from './types';

const data = (): ERPLivestockData => ({
  stock: [{ id: 'A1', location: 'Farm A', status: 'Active' }, { id: 'A2', location: 'farm a ', status: 'Sold' }, { id: 'B1', location: 'Farm B', status: 'Active' }],
  batches: [{ id: 'BT-A', farmLocation: 'Farm A', cowIds: ['A1', 'B1'] }, { id: 'BT-B', farmLocation: 'Farm B', cowIds: ['B1'] }, { id: 'BT-NONE', cowIds: [] }],
  weightTracking: [{ cowId: 'A1' }, { cowId: 'B1' }],
  healthLogs: [{ cowId: 'A1' }, { cowId: 'B1' }],
  salesTracking: [{ cowId: 'A2' }, { cowId: 'B1' }],
  farmCosts: [{ id: 'C1', farmLocation: 'Farm A' }, { id: 'C2', farmLocation: 'Farm B' }],
  feedTransactions: [
    { id: 'T1', type: 'STOCK_IN', sourceFarm: 'Supplier', targetFarm: 'Farm A' },
    { id: 'T2', type: 'STOCK_OUT', sourceFarm: 'Farm A', targetFarm: 'Daily Feeding Ration' },
    { id: 'T3', type: 'STOCK_IN', sourceFarm: 'Supplier', targetFarm: 'Farm B' },
  ],
  settings: { farms: [{ id: 'F1', name: 'Farm A' }, { id: 'F2', name: 'Farm B' }], users: [{ id: 'u' }] },
  common: { locations: ['Farm A', 'Farm B'] },
} as unknown as ERPLivestockData);

describe('validFocus', () => {
  it('keeps a farm that exists and forgets one that does not', () => {
    expect(validFocus('Farm A', ['Farm A', 'Farm B'])).toBe('Farm A');
    expect(validFocus('Gone', ['Farm A', 'Farm B'])).toBe('');
    expect(validFocus('', ['Farm A'])).toBe('');
  });
});

describe('scopeDataToFarm', () => {
  it('keeps only the farm\'s cattle, batches and records, and leaves the settings alone', () => {
    const r = scopeDataToFarm(data(), 'Farm A');
    expect(r.stock.map(c => c.id)).toEqual(['A1', 'A2']);
    expect(r.weightTracking).toHaveLength(1);
    expect(r.healthLogs).toHaveLength(1);
    expect(r.salesTracking.map(s => s.cowId)).toEqual(['A2']);
    expect(r.batches.map(b => b.id)).toEqual(['BT-A', 'BT-NONE']);
    expect(r.batches[0].cowIds).toEqual(['A1']);
    expect(r.farmCosts!.map(c => c.id)).toEqual(['C1']);
    expect(r.settings.farms).toHaveLength(2);
    expect(r.settings.users).toHaveLength(1);
  });
  it('leaves feed movements alone unless asked, then keeps only those touching the farm', () => {
    expect(scopeDataToFarm(data(), 'Farm A').feedTransactions).toHaveLength(3);
    expect(scopeDataToFarm(data(), 'Farm A', { includeFeed: true }).feedTransactions!.map(t => t.id)).toEqual(['T1', 'T2']);
    expect(scopeDataToFarm(data(), 'Farm B', { includeFeed: true }).feedTransactions!.map(t => t.id)).toEqual(['T3']);
  });
  it('does not change what a farm-bound person is sent', () => {
    const actor = { id: 'x', role: 'Farm Staff', farmLocation: 'Farm A', permissions: ['costs_view'] } as never;
    const r = scopeDataForActor(data(), actor);
    expect(r.stock.map(c => c.id)).toEqual(['A1', 'A2']);
    expect(r.feedTransactions).toHaveLength(3);
    expect(r.farmCosts!.map(c => c.id)).toEqual(['C1']);
  });
});
