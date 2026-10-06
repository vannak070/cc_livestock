import { describe, expect, it } from 'vitest';
import { alertFarms, buildMorningMessages, type DigestData } from './farm-alerts';

const NOW = new Date('2026-10-06T02:00:00Z'); // 09:00 on the farm, 2026-10-06
const cow = (id: string, farm: string, extra: Record<string, unknown> = {}) => ({ id, status: 'Active', location: farm, sex: 'M', healthStatus: 'healthy', purchaseDate: '2026-09-01', ...extra });
const data = (over: Partial<Record<keyof DigestData, unknown>> = {}): DigestData => ({
  stock: [cow('A1', 'Farm A'), cow('B1', 'Farm B')],
  batches: [],
  weightTracking: [{ cowId: 'A1', trackingDate: '2026-10-05', currentWeight: 300 }, { cowId: 'B1', trackingDate: '2026-10-05', currentWeight: 300 }],
  settings: { farms: [{ id: '1', name: 'Farm A' }, { id: '2', name: 'Farm B' }, { id: '3', name: 'Empty Farm' }] },
  feedProducts: [], feedTransactions: [], cattleFollowUps: [], ...over,
}) as unknown as DigestData;

const byKind = (msgs: ReturnType<typeof buildMorningMessages>, kind: string) => msgs.filter(m => m.kind === kind);

describe('alertFarms', () => {
  it('lists farms that have animals, and leaves out a farm with nothing on it', () => {
    expect(alertFarms(data())).toEqual(['Farm A', 'Farm B']);
  });
});

describe('no daily report', () => {
  it('sends no daily report: a quiet day gives no messages at all', () => {
    expect(buildMorningMessages(data(), NOW)).toEqual([]);
  });

  it('does not report sick animals or animals to weigh by Telegram', () => {
    const d = data({ stock: [cow('A1', 'Farm A', { healthStatus: 'sick' }), cow('B1', 'Farm B')], weightTracking: [] });
    expect(buildMorningMessages(d, NOW)).toEqual([]);
  });
});

describe('selling reminder, per farm', () => {
  const batch = (id: string, farm: string, target: string, extra: Record<string, unknown> = {}) => ({ id, name: `Batch ${id}`, status: 'Active', farmLocation: farm, startDate: '2026-06-01', sellingTargetDate: target, cowIds: [farm === 'Farm A' ? 'A1' : 'B1'], ...extra });

  it('sends a farm the batches near their selling date, and other farms nothing', () => {
    const d = data({ batches: [batch('1', 'Farm A', '2026-10-10')] });
    const sale = byKind(buildMorningMessages(d, NOW), 'sale');
    expect(sale).toHaveLength(1);
    expect(sale[0].farm).toBe('Farm A');
    expect(sale[0].message).toContain('Selling reminder');
    expect(sale[0].message).toContain('Sell by 10 Oct (in 4 days)');
    expect(sale[0].message).toContain('Please decide: sell, or keep feeding.');
    expect(sale[0].message).toContain('<b>Batch 1</b>');
  });

  it('gives males and females, lowest and highest weight, and the selling price', () => {
    const d = data({
      stock: [cow('A1', 'Farm A'), cow('A2', 'Farm A', { sex: 'Female' }), cow('A3', 'Farm A', { sex: 'ញី' })],
      weightTracking: [{ cowId: 'A1', trackingDate: '2026-10-05', currentWeight: 360 }, { cowId: 'A2', trackingDate: '2026-10-05', currentWeight: 465 }, { cowId: 'A3', trackingDate: '2026-10-05', currentWeight: 411 }],
      batches: [batch('1', 'Farm A', '2026-10-10', { cowIds: ['A1', 'A2', 'A3'], expectedSellingPrice: 12500 })],
    });
    const msg = byKind(buildMorningMessages(d, NOW), 'sale')[0].message;
    expect(msg).toContain('<b>Batch 1</b>: 3 animals (1 male, 2 female)');
    expect(msg).toContain('Weight: 360 to 465 kg (average 412 kg)');
    expect(msg).toContain('Selling price: 12,500 ៛ per kg (about 15,450,000 ៛ in total)');
  });

  it('says plainly when no selling price is set', () => {
    const d = data({ batches: [batch('1', 'Farm A', '2026-10-10')] });
    expect(byKind(buildMorningMessages(d, NOW), 'sale')[0].message).toContain('Selling price: not set yet');
  });

  it('says how late a batch is', () => {
    const d = data({ batches: [batch('1', 'Farm B', '2026-10-04')] });
    expect(byKind(buildMorningMessages(d, NOW), 'sale')[0].message).toContain('Sell by 4 Oct (2 days late)');
  });

  it('leaves out batches that are far off or already marked Ready to sell', () => {
    const d = data({ batches: [batch('1', 'Farm A', '2026-12-30'), batch('2', 'Farm B', '2026-10-08', { saleReview: { decision: 'ready' } })] });
    expect(byKind(buildMorningMessages(d, NOW), 'sale')).toEqual([]);
  });
});

describe('long time on the farm, per farm', () => {
  it('lists the animals that have been there months, for their own farm', () => {
    const d = data({ stock: [cow('A1', 'Farm A', { purchaseDate: '2026-02-01' }), cow('A2', 'Farm A', { purchaseDate: '2026-09-20' }), cow('B1', 'Farm B')] });
    const long = byKind(buildMorningMessages(d, NOW), 'longstay');
    expect(long).toHaveLength(1);
    expect(long[0].farm).toBe('Farm A');
    expect(long[0].message).toContain('Long time on the farm');
    expect(long[0].message).toContain('A1 (8 months)');
    expect(long[0].message).not.toContain('A2');
    expect(long[0].message).toContain('• No next step written down: 1');
  });

  it('sends nothing when no animal has stayed that long', () => {
    expect(byKind(buildMorningMessages(data(), NOW), 'longstay')).toEqual([]);
  });
});
