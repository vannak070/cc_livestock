import { describe, expect, it } from 'vitest';
import { buybackSchedule, canSeeActionPlans, canWritePlans, contractProblem, dueBucket, type BatchContract } from './action-plans';

const cow = (id: string, location: string, weight: number, status = 'Active', purchaseDate: string | null = '2026-06-10T00:00:00.000Z') =>
  ({ id, location, weight, status, purchaseDate }) as never;
const batch = (id: string, farm: string, cowIds: string[], extra: object = {}) =>
  ({ id, name: `Batch ${id}`, type: 'Fattening', startDate: '2026-06-10', status: 'Active', farmLocation: farm, cowIds, ...extra }) as never;
const contract = (batchId: string, price?: number): BatchContract => ({ batchId, contractNo: `C-${batchId}`, buybackPricePerKg: price, notes: '', updatedBy: '', updatedAt: '' });

describe('who may do what', () => {
  it.each([
    ['Super Admin', true, true],
    ['Admin', true, true],
    ['Management', true, false],
    ['Company', false, false],
    ['Farm Owner', false, false],
  ])('%s: see %s, write %s (Management only reads; there is no approval)', (role, see, write) => {
    expect([canSeeActionPlans({ role }), canWritePlans({ role })]).toEqual([see, write]);
  });
});

describe('dueBucket', () => {
  it.each([[-1, 'overdue'], [0, 'd7'], [7, 'd7'], [8, 'd30'], [30, 'd30'], [31, 'd60'], [60, 'd60'], [61, 'later'], [undefined, 'noDate']])('%s days → %s', (days, bucket) => {
    expect(dueBucket(days as number | undefined)).toBe(bucket);
  });
});

describe('buybackSchedule', () => {
  const stock = [cow('A', 'SNR Farm', 300), cow('B', 'SNR Farm', 320), cow('C', 'SNR Farm', 280, 'Sold'), cow('D', 'CC_001', 250)];

  it('counts only cattle still on the farm and values them at the contract price', () => {
    const [row] = buybackSchedule([batch('B1', 'SNR Farm', ['A', 'B', 'C'], { sellingTargetDate: '2026-10-20' })], stock, [contract('B1', 12_000)], '2026-10-14');
    expect(row).toMatchObject({ head: 2, estKg: 620, pricePerKg: 12_000, priceIsEstimate: false, value: 620 * 12_000, daysLeft: 6, bucket: 'd7', contractNo: 'C-B1' });
  });

  it("uses the price set on the batch when the contract has no price", () => {
    const [row] = buybackSchedule([batch('B1', 'SNR Farm', ['A'], { expectedSellingPrice: 12_500 })], stock, [], '2026-10-14');
    expect(row).toMatchObject({ pricePerKg: 12_500, priceSource: 'batch', priceIsEstimate: false, contractNo: '', bucket: 'noDate' });
  });

  it("takes the price from the batch's contract, else the price set on the batch, else the farm's plan price", () => {
    const farmPrices = new Map([['SNR Farm', 11_800]]);
    const rows = buybackSchedule([
      batch('C', 'SNR Farm', ['A'], { expectedSellingPrice: 12_500 }),
      batch('B', 'SNR Farm', ['B'], { expectedSellingPrice: 13_200 }),
      batch('P', 'SNR Farm', ['A'], {}),
      batch('N', 'CC_001', ['D'], {}),
    ], stock, [contract('C', 12_000)], '2026-10-14', farmPrices);
    const by = Object.fromEntries(rows.map(r => [r.batchId, r]));
    expect(by.C).toMatchObject({ priceSource: 'contract', pricePerKg: 12_000, priceIsEstimate: false });
    expect(by.B).toMatchObject({ priceSource: 'batch', pricePerKg: 13_200, priceIsEstimate: false, value: 320 * 13_200 });
    expect(by.P).toMatchObject({ priceSource: 'plan', pricePerKg: 11_800, priceIsEstimate: true });
    expect(by.N).toMatchObject({ priceSource: undefined, value: undefined });
  });

  it("ignores a farm's plan price when there is none, as before", () => {
    const [row] = buybackSchedule([batch('B1', 'SNR Farm', ['A'], { expectedSellingPrice: 12_500 })], stock, [], '2026-10-14', new Map());
    expect(row).toMatchObject({ priceSource: 'batch', pricePerKg: 12_500, priceIsEstimate: false });
  });

  it('leaves out closed batches and batches with no cattle left, and lists the soonest first', () => {
    const rows = buybackSchedule([
      batch('LATE', 'SNR Farm', ['A'], { sellingTargetDate: '2027-01-08' }),
      batch('CLOSED', 'SNR Farm', ['B'], { status: 'Closed', sellingTargetDate: '2026-10-01' }),
      batch('EMPTY', 'SNR Farm', ['C'], { sellingTargetDate: '2026-10-01' }),
      batch('NODATE', 'CC_001', ['D']),
      batch('SOON', 'SNR Farm', ['B'], { sellingTargetDate: '2026-10-10' }),
    ], stock, [], '2026-10-14');
    expect(rows.map(r => [r.batchId, r.bucket])).toEqual([['SOON', 'overdue'], ['LATE', 'later'], ['NODATE', 'noDate']]);
  });
});

describe('contractProblem', () => {
  it('accepts a contract with no price yet', () => {
    expect(contractProblem({ contractNo: 'C-1', notes: '' })).toBeNull();
  });
  it('refuses a price of zero or less', () => {
    expect(contractProblem({ contractNo: 'C-1', buybackPricePerKg: 0, notes: '' })).toMatch(/more than 0/);
  });
});
