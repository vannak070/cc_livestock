import { describe, expect, it } from 'vitest';
import { DATA_PARTS, isDataPart, partsToRead, pickParts } from './data-parts';
import { scopeDataToFarm } from './farm-view';
import type { ERPLivestockData } from './types';

const data = {
  stock: [{ id: 'A', location: 'SNR Farm' }, { id: 'B', location: 'CC_001' }],
  weightTracking: [{ cowId: 'A' }, { cowId: 'B' }],
  salesTracking: [], healthLogs: [], batches: [], feedProducts: [], feedTransactions: [], proposalPlans: [], farmCosts: [],
  farmLimitRequests: [], farmLimitChanges: [], cattleFollowUps: [],
  settings: { farms: [] }, common: { breeds: ['Brahman'] },
} as unknown as ERPLivestockData;

describe('data parts', () => {
  it('knows its parts and ignores anything else', () => {
    expect(DATA_PARTS).toContain('stock');
    expect(isDataPart('weightTracking')).toBe(true);
    expect(isDataPart('users')).toBe(false);
    expect(isDataPart(7)).toBe(false);
  });

  it('picks only the requested parts, and the derived lists come with settings', () => {
    expect(Object.keys(pickParts(data, ['weightTracking', 'nonsense']))).toEqual(['weightTracking']);
    expect(Object.keys(pickParts(data, ['settings'])).sort()).toEqual(['common', 'settings']);
  });

  it('reads the cattle too for a farm-bound user whose parts are trimmed by cattle ids', () => {
    expect(partsToRead(['weightTracking'], true)).toEqual(['weightTracking', 'stock']);
    expect(partsToRead(['weightTracking'], false)).toEqual(['weightTracking']);
    expect(partsToRead(['feedProducts'], true)).toEqual(['feedProducts']);
    expect(partsToRead(['stock', 'batches'], true)).toEqual(['stock', 'batches']);
  });

  it('without the cattle, a farm view would wrongly empty the weights (why the cattle are read)', () => {
    const withoutStock = { ...data, stock: [] } as ERPLivestockData;
    expect(scopeDataToFarm(withoutStock, 'SNR Farm').weightTracking).toEqual([]);
    expect(scopeDataToFarm(data, 'SNR Farm').weightTracking).toEqual([{ cowId: 'A' }]);
  });
});
