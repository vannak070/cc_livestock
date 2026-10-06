import { describe, expect, it } from 'vitest';
import { buildDailyDigest, type DigestData } from './daily-digest';

const NOW = new Date('2026-10-06T02:00:00Z'); // 09:00 on the farm
const cow = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: 'Active', location: 'SNR Farm', sex: 'M', healthStatus: 'healthy', ...extra });
const data = (over: Partial<Record<keyof DigestData, unknown>> = {}): DigestData => ({
  stock: [], batches: [], weightTracking: [], settings: {}, feedProducts: [], feedTransactions: [], cattleFollowUps: [], ...over,
}) as unknown as DigestData;

describe('buildDailyDigest', () => {
  it('says nothing on a quiet day', () => {
    expect(buildDailyDigest(data(), NOW, 'morning').message).toBeNull();
    expect(buildDailyDigest(data(), NOW, 'evening').message).toBeNull();
  });

  it('lists sick animals and animals overdue for weighing by farm', () => {
    const d = data({ stock: [cow('A1', { healthStatus: 'sick' }), cow('A2'), cow('B1', { location: 'Other' })] });
    const { message, lines } = buildDailyDigest(d, NOW, 'morning');
    expect(lines.map(l => l.icon)).toContain('🔴');
    expect(message).toContain('1 animal is unwell: A1');
    expect(message).toContain('3 animals are overdue for weighing');
    expect(message).toContain('SNR Farm 2, Other 1');
    expect(message).toContain('Daily check');
  });

  it('leaves out sold animals', () => {
    const d = data({ stock: [cow('S1', { status: 'Sold', healthStatus: 'sick' })] });
    expect(buildDailyDigest(d, NOW, 'morning').message).toBeNull();
  });

  it('keeps the evening message to the feed reminder, so a sick animal is not repeated', () => {
    const d = data({ stock: [cow('A1', { healthStatus: 'sick' })] });
    expect(buildDailyDigest(d, NOW, 'evening').message).toBeNull();
  });

  it('escapes names so they cannot be read as tags', () => {
    const d = data({ stock: [cow('<b>x</b>', { healthStatus: 'sick' })] });
    expect(buildDailyDigest(d, NOW, 'morning').message).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  describe('low feed, farm by farm', () => {
    const products = [{ id: 'P1', name: 'Concentrate', unit: 'bag', weightPerUnit: 30, minThresholdBags: 50, minThresholdKg: 1500, status: 'Active' }];
    const batch = (farm: string) => ({ id: `B-${farm}`, name: `B ${farm}`, status: 'Active', farmLocation: farm, startDate: '2026-10-06', cowIds: [`${farm}1`], feedingProgram: { status: 'Active', ingredients: [{ name: 'Concentrate', productId: 'P1', portionPerHead: 4 }] } });
    const stockIn = (farm: string, bags: number) => ({ id: `T-${farm}`, date: '2026-10-01', productId: 'P1', productName: 'Concentrate', type: 'STOCK_IN', quantityBags: bags, quantityKg: bags * 30, targetFarm: farm });
    const base = () => data({
      stock: [cow('Low1', { location: 'Low Farm', lastWeighDate: '2026-10-05' }), cow('Ok1', { location: 'Ok Farm' })].map(c => ({ ...c, id: c.location === 'Low Farm' ? 'Low Farm1' : 'Ok Farm1' })),
      batches: [batch('Low Farm'), batch('Ok Farm')], feedProducts: products,
      feedTransactions: [stockIn('Low Farm', 10), stockIn('Ok Farm', 200)],
    });

    it('names the farm that is running low, not the others', () => {
      const msg = buildDailyDigest(base(), NOW, 'morning').message ?? '';
      expect(msg).toMatch(/<b>Low Farm<\/b>: feed running low, <b>Concentrate<\/b>/);
      expect(msg).toContain('Minimum is 50 bags');
      expect(msg).not.toMatch(/<b>Ok Farm<\/b>: feed running low/);
    });
  });
});
