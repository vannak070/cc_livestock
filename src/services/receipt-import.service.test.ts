import { beforeEach, describe, expect, it, vi } from 'vitest';

const extract = vi.hoisted(() => ({ extractReceipt: vi.fn() }));
const stock = vi.hoisted(() => ({ createMany: vi.fn() }));
vi.mock('./receipt-extract.service', () => extract);
vi.mock('./stock.service', () => ({ stockService: stock }));

import { ReceiptImportService } from './receipt-import.service';
import type { RegisterInput } from '../lib/receipt-import';
import type { Actor } from '../lib/authz';

const service = new ReceiptImportService();
const actor = (role: string) => ({ id: 'u', name: `${role} Person`, email: 'p@x.test', role, status: 'Active' }) as Actor;
const input: RegisterInput = {
  farm: 'SNR Farm', date: '2026-06-25', seller: 'Vannak', invoiceNo: '202606-004', prefix: 'CC-', breed: '', health: 'Good',
  rows: [{ printed: '296', sex: 'Male', weightKg: 306, pricePerKg: 12_500, lineTotal: 3_825_000 }],
};

beforeEach(() => {
  extract.extractReceipt.mockReset().mockResolvedValue({ rows: [] });
  stock.createMany.mockReset().mockResolvedValue([]);
});

describe('who may use receipts', () => {
  it.each(['Super Admin', 'Admin'])('%s may read and register', async role => {
    await service.read(actor(role), { mediaType: 'application/pdf', base64: 'AA==' });
    await service.register(actor(role), input);
    expect(extract.extractReceipt).toHaveBeenCalledTimes(1);
    expect(stock.createMany).toHaveBeenCalledTimes(1);
  });

  it.each(['Management', 'Farm Owner', 'Farm Staff', 'Company'])('%s is refused, and nothing is read or saved', async role => {
    await expect(service.read(actor(role), { mediaType: 'application/pdf', base64: 'AA==' })).rejects.toThrow(/Super Admin or Admin/);
    await expect(service.register(actor(role), input)).rejects.toThrow(/Super Admin or Admin/);
    expect(extract.extractReceipt).not.toHaveBeenCalled();
    expect(stock.createMany).not.toHaveBeenCalled();
  });
});

describe('register', () => {
  it('saves bought-by-the-kg records billed to the person who registered them', async () => {
    await service.register(actor('Admin'), input);
    const [items, by] = stock.createMany.mock.calls[0];
    expect(by).toBe('Admin Person');
    expect(items[0]).toMatchObject({ id: 'CC-296', buyType: 'Weight', unitPrice: 12_500, totalPrice: 3_825_000, location: 'SNR Farm' });
  });

  it('refuses a list with a problem before anything is saved', async () => {
    await expect(service.register(actor('Admin'), { ...input, rows: [{ ...input.rows[0], sex: '' }] })).rejects.toThrow(/Row 1/);
    await expect(service.register(actor('Admin'), { ...input, farm: '' })).rejects.toThrow(/farm/i);
    expect(stock.createMany).not.toHaveBeenCalled();
  });
});
