import { beforeEach, describe, expect, it, vi } from 'vitest';

const stock = vi.hoisted(() => ({ findById: vi.fn(), findAll: vi.fn(), update: vi.fn() }));
const sales = vi.hoisted(() => ({ create: vi.fn(), delete: vi.fn() }));
const batches = vi.hoisted(() => ({ findById: vi.fn(), update: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));
vi.mock('../repositories/sales.repository', () => ({ salesRepository: sales }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: batches }));

import { SalesService } from './sales.service';

const service = new SalesService();
const cow = (id: string, weight: number, status = 'Active') => ({ id, breed: 'B', age: '2', weight, status });

beforeEach(() => {
  [stock, sales, batches].forEach(repo => Object.values(repo).forEach(f => f.mockReset()));
  sales.create.mockImplementation(async (r: unknown) => r);
});

describe('SalesService.recordSale', () => {
  it('prices a weight sale as weight × price per kg and labels it Scale', async () => {
    stock.findById.mockResolvedValue(cow('CC-1', 320));
    const sale = await service.recordSale('CC-1', 12_300, 'Weight', '2026-10-10', 'Trader A');
    expect(sale).toMatchObject({ totalPrice: 320 * 12_300, saleType: 'Scale', buyer: 'Trader A', salesDate: '2026-10-10' });
    expect(stock.update).toHaveBeenCalledWith('CC-1', { status: 'Sold' }, { tx: true });
  });

  it('takes a lump-sum price as the total, whatever the weight', async () => {
    stock.findById.mockResolvedValue(cow('CC-1', 320));
    await expect(service.recordSale('CC-1', 4_000_000, 'Lumpsum')).resolves.toMatchObject({ totalPrice: 4_000_000, saleType: 'Lumpsum', buyer: 'Local Market' });
  });

  it('refuses to sell an animal that is already sold, so the money is never counted twice', async () => {
    stock.findById.mockResolvedValue(cow('CC-1', 320, 'Sold'));
    await expect(service.recordSale('CC-1', 12_300, 'Weight')).rejects.toThrow(/already sold/);
    expect(stock.update).not.toHaveBeenCalled();
    expect(sales.create).not.toHaveBeenCalled();
  });

  it('refuses an unknown animal', async () => {
    stock.findById.mockResolvedValue(null);
    await expect(service.recordSale('NOPE', 1, 'Lumpsum')).rejects.toThrow(/NOPE not found/);
    expect(sales.create).not.toHaveBeenCalled();
  });
});

describe('SalesService.recordBatchSale', () => {
  beforeEach(() => {
    batches.findById.mockResolvedValue({ id: 'B1', cowIds: ['CC-1', 'CC-2', 'CC-3'] });
    stock.findAll.mockResolvedValue([cow('CC-1', 300), cow('CC-2', 350), cow('CC-3', 280, 'Sold'), cow('CC-9', 400)]);
  });

  it("sells only the batch's animals still on the farm, then closes the batch", async () => {
    const records = await service.recordBatchSale('B1', 12_000, 'Weight', '2026-10-12');
    expect(records.map(r => r.cowId)).toEqual(['CC-1', 'CC-2']);
    expect(records.map(r => r.totalPrice)).toEqual([300 * 12_000, 350 * 12_000]);
    expect(batches.update).toHaveBeenCalledWith('B1', { status: 'Closed' }, { tx: true });
  });

  it('labels a weight-priced batch sale Scale, the same as a single sale', async () => {
    const records = await service.recordBatchSale('B1', 12_000, 'Weight');
    expect(records.every(r => r.saleType === 'Scale')).toBe(true);
  });

  it('labels a lump-sum batch sale Lumpsum, one price per animal', async () => {
    const records = await service.recordBatchSale('B1', 3_500_000, 'Lumpsum');
    expect(records.map(r => [r.saleType, r.totalPrice])).toEqual([['Lumpsum', 3_500_000], ['Lumpsum', 3_500_000]]);
  });

  it('records the buyer on every sale (a buy-back is a sale to CC Livestock), Local Market when none is given', async () => {
    expect((await service.recordBatchSale('B1', 12_000, 'Weight', '2026-10-12', 'CC Livestock')).map(r => r.buyer)).toEqual(['CC Livestock', 'CC Livestock']);
    expect((await service.recordBatchSale('B1', 12_000, 'Weight')).map(r => r.buyer)).toEqual(['Local Market', 'Local Market']);
  });

  it('refuses an unknown batch and sells nothing', async () => {
    batches.findById.mockResolvedValue(null);
    await expect(service.recordBatchSale('NOPE', 1, 'Lumpsum')).rejects.toThrow(/NOPE not found/);
    expect(sales.create).not.toHaveBeenCalled();
  });
});

describe('SalesService.deleteSalesRecord', () => {
  it('puts the animal back on the farm when its sale is removed', async () => {
    sales.delete.mockResolvedValue(true);
    await expect(service.deleteSalesRecord('CC-1')).resolves.toBe(true);
    expect(stock.update).toHaveBeenCalledWith('CC-1', { status: 'Active' }, { tx: true });
  });

  it('leaves the animal alone when there was no sale to remove', async () => {
    sales.delete.mockResolvedValue(false);
    await service.deleteSalesRecord('CC-1');
    expect(stock.update).not.toHaveBeenCalled();
  });
});
