import { describe, expect, it } from 'vitest';
import type { BatchItem } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { availabilityOf, batchOffered, farmWindows, listingFacts, listingProblem, sexLabel, weightClassEdges, weightRangeLabel } from './listing';

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

describe('weight ranges', () => {
  it('gives the kg edges of each class, open at both ends', () => {
    expect(weightClassEdges('Under 250 kg')).toEqual({ from: null, to: 250 });
    expect(weightClassEdges('250–300 kg')).toEqual({ from: 250, to: 300 });
    expect(weightClassEdges('350–400 kg')).toEqual({ from: 350, to: 400 });
    expect(weightClassEdges('400 kg+')).toEqual({ from: 400, to: null });
  });
  it('writes a range for people', () => {
    expect(weightRangeLabel(300, 400)).toBe('300–400 kg');
    expect(weightRangeLabel(null, 250)).toBe('Under 250 kg');
    expect(weightRangeLabel(400, null)).toBe('400 kg+');
    expect(weightRangeLabel(null, null)).toBe('Any size');
  });
});

describe('what a farm has for sale', () => {
  const stock = ['A', 'B', 'C', 'D', 'E', 'F'].map(id => cow(id, { sex: id === 'F' ? 'Female' : 'Male' }));
  // B1: 3 animals about 330 kg, selling in 5 days (now). B2: 3 animals about 410 kg, selling in 40 days (soon).
  const weights = [w('A', 320, '2026-10-01'), w('B', 330, '2026-10-01'), w('C', 340, '2026-10-01'), w('D', 405, '2026-10-01'), w('E', 410, '2026-10-01'), w('F', 415, '2026-10-01')];
  const b1 = batch({ id: 'B1', cowIds: ['A', 'B', 'C'], sellingTargetDate: '2026-10-12' });
  const b2 = batch({ id: 'B2', cowIds: ['D', 'E', 'F'], sellingTargetDate: '2026-11-16' });
  const listing = (batchId: string, published: boolean) => ({ batchId, published, publicBreed: '', publicSex: '' });

  it('offers a batch by its sell schedule, with no click needed', () => {
    expect(farmWindows([b1], [], stock, weights, TODAY, 15)).toEqual([{ availability: 'now', headCount: 'Under 10', weightFrom: 300, weightTo: 350 }]);
  });

  it('keeps "now" and "soon" apart for one farm, now first', () => {
    const windows = farmWindows([b2, b1], [], stock, weights, TODAY, 15);
    expect(windows.map(x => x.availability)).toEqual(['now', 'soon']);
    expect(windows[1]).toMatchObject({ weightFrom: 400, weightTo: null });
  });

  it('adds up batches in the same window and spans their weight classes', () => {
    const other = batch({ id: 'B3', cowIds: ['D', 'E', 'F'], sellingTargetDate: '2026-10-14' });
    const windows = farmWindows([b1, other], [], stock, weights, TODAY, 15);
    // 3 + 3 = 6 healthy animals (rounded: "Under 10"), spanning the 300–350 kg class up to the 400 kg+ class
    expect(windows).toEqual([{ availability: 'now', headCount: 'Under 10', weightFrom: 300, weightTo: null }]);
  });

  it('leaves out a batch the office switched off, one with no schedule, a closed one and one with no healthy animals', () => {
    expect(farmWindows([b1], [listing('B1', false)], stock, weights, TODAY, 15)).toEqual([]);
    expect(farmWindows([batch({ id: 'B9', cowIds: ['A'] })], [], stock, weights, TODAY, 15)).toEqual([]);
    expect(farmWindows([{ ...b1, status: 'Closed' }], [], stock, weights, TODAY, 15)).toEqual([]);
    const sick = stock.map(c => ({ ...c, healthStatus: 'Poor' }));
    expect(farmWindows([b1], [], sick, weights, TODAY, 15)).toEqual([]);
  });

  it('still offers a batch the office put on, and follows a "soon" override', () => {
    expect(farmWindows([b1], [listing('B1', true)], stock, weights, TODAY, 15)).toHaveLength(1);
    const forced = farmWindows([batch({ id: 'B4', cowIds: ['A', 'B'] })], [{ ...listing('B4', true), overrideAvailability: 'soon' }], stock, weights, TODAY, 15);
    expect(forced.map(x => x.availability)).toEqual(['soon']);
  });

  it('is offered by default and only off when the office said so', () => {
    expect(batchOffered(undefined)).toBe(true);
    expect(batchOffered(null)).toBe(true);
    expect(batchOffered({ published: true })).toBe(true);
    expect(batchOffered({ published: false })).toBe(false);
  });
});

