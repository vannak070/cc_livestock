import { describe, expect, it } from 'vitest';
import type { BatchItem } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { availabilityOf, listingFacts, listingProblem, sexLabel } from './listing';

const cow = (id: string, extra: Partial<StockItem> = {}) => ({ id, status: 'Active', sex: 'Male', breed: 'Brahman cross', healthStatus: 'Good', weight: 300, location: 'SNR Farm', ...extra }) as StockItem;
const batch = (extra: Partial<BatchItem> = {}) => ({ id: 'B1', name: 'Batch 1', type: 'Fattening', startDate: '2026-06-01', status: 'Active', cowIds: ['A', 'B', 'C'], farmLocation: 'SNR Farm', ...extra }) as BatchItem;
const w = (cowId: string, kg: number, day: string) => ({ cowId, currentWeight: kg, trackingDate: day }) as WeightRecord;
const TODAY = '2026-10-07';

describe('availability', () => {
  it('is "now" inside the sale window, or late, or when marked Ready to sell', () => {
    expect(availabilityOf({ sellingTargetDate: '2026-10-20' }, undefined, TODAY, 15)).toBe('now');
    expect(availabilityOf({ sellingTargetDate: '2026-10-01' }, undefined, TODAY, 15)).toBe('now');
    expect(availabilityOf({ sellingTargetDate: '2027-03-01', saleReview: { decision: 'ready', by: 'x', at: 'x' } }, undefined, TODAY, 15)).toBe('now');
  });
  it('is "soon" within 60 days, and not listed later or without a date', () => {
    expect(availabilityOf({ sellingTargetDate: '2026-11-20' }, undefined, TODAY, 15)).toBe('soon');
    expect(availabilityOf({ sellingTargetDate: '2027-01-30' }, undefined, TODAY, 15)).toBeNull();
    expect(availabilityOf({}, undefined, TODAY, 15)).toBeNull();
  });
  it('follows the office override', () => {
    expect(availabilityOf({}, 'soon', TODAY, 15)).toBe('soon');
  });
});

describe('listing facts', () => {
  it('uses only healthy animals and their latest weights, rounded into classes', () => {
    const stock = [cow('A'), cow('B', { sex: 'Female' }), cow('C', { healthStatus: 'Poor' })];
    const weights = [w('A', 380, '2026-09-01'), w('A', 420, '2026-10-01'), w('B', 400, '2026-10-01'), w('C', 100, '2026-10-01')];
    const f = listingFacts(batch({ sellingTargetDate: '2026-10-15' }), undefined, stock, weights, TODAY, 15);
    expect(f).toMatchObject({ breed: 'Brahman cross', sex: 'Male and female', weightClass: '400 kg+', headCount: 'Under 10', availability: 'now', healthyHead: 2 });
  });
  it('lets the office set the breed and sex shown', () => {
    const f = listingFacts(batch(), { publicBreed: 'Brahman', publicSex: 'Male', overrideAvailability: 'soon' }, [cow('A')], [], TODAY, 15);
    expect(f).toMatchObject({ breed: 'Brahman', sex: 'Male', weightClass: '300–350 kg', availability: 'soon' });
  });
  it('reads Khmer sexes', () => {
    expect(sexLabel([cow('A', { sex: 'ញី' })])).toBe('Female');
  });
});

describe('listing problems', () => {
  it('needs an active batch on a published farm with healthy animals', () => {
    expect(listingProblem({ status: 'Closed' }, true, 5)).toMatch(/active/);
    expect(listingProblem({ status: 'Active' }, false, 5)).toMatch(/farm is not on the website/);
    expect(listingProblem({ status: 'Active' }, true, 0)).toMatch(/healthy/);
    expect(listingProblem({ status: 'Active' }, true, 5)).toBeNull();
  });
});
