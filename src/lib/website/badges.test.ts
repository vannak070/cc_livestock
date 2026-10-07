import { describe, expect, it } from 'vitest';
import type { BatchItem, FeedStockTransaction, HealthLogItem } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { addDays, dailyRef } from '../daily-feed';
import { badgesFor, feedBadge, vetBadge, weighingBadge } from './badges';

const TODAY = '2026-10-07';
const batch = { id: 'B1', status: 'Active', cowIds: ['A'] } as BatchItem;
const feedOn = (days: number[]) => days.map(d => ({ id: `t${d}`, referenceNo: dailyRef('B1', addDays(TODAY, -d), 'P1') }) as FeedStockTransaction);
const cow = { id: 'A', status: 'Active', purchaseDate: '2026-01-01' } as StockItem;

describe('standards badges', () => {
  it('feed: needs feed recorded on 27 of the last 30 days', () => {
    const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(feedBadge({ batches: [batch], feedTransactions: feedOn(range(27)), today: TODAY })).toBe(true);
    expect(feedBadge({ batches: [batch], feedTransactions: feedOn(range(26)), today: TODAY })).toBe(false);
    expect(feedBadge({ batches: [], feedTransactions: [], today: TODAY })).toBe(false);
  });

  it('weighing: every active animal weighed within 60 days', () => {
    const recent = [{ cowId: 'A', trackingDate: '2026-09-01' }] as WeightRecord[];
    const old = [{ cowId: 'A', trackingDate: '2026-07-01' }] as WeightRecord[];
    expect(weighingBadge({ cattle: [cow], weights: recent, today: TODAY })).toBe(true);
    expect(weighingBadge({ cattle: [cow], weights: old, today: TODAY })).toBe(false);
    expect(weighingBadge({ cattle: [], weights: recent, today: TODAY })).toBe(false);
  });

  it('vet: a vaccination or treatment in the last 6 months, not a disease note', () => {
    const vacc = [{ cowId: 'A', type: 'Vaccination', date: '2026-08-01' }] as HealthLogItem[];
    const disease = [{ cowId: 'A', type: 'Disease', date: '2026-08-01' }] as HealthLogItem[];
    expect(vetBadge({ cattle: [cow], healthLogs: vacc, today: TODAY })).toBe(true);
    expect(vetBadge({ cattle: [cow], healthLogs: disease, today: TODAY })).toBe(false);
  });

  it('lists the badges a farm has earned', () => {
    expect(badgesFor({ cattle: [cow], batches: [batch], weights: [{ cowId: 'A', trackingDate: '2026-10-01' } as WeightRecord], feedTransactions: [], healthLogs: [], today: TODAY })).toEqual(['weighing']);
  });
});
