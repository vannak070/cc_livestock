import { beforeEach, describe, expect, it, vi } from 'vitest';

const stock = vi.hoisted(() => ({ findById: vi.fn(), findByIds: vi.fn(), update: vi.fn() }));
const weights = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), delete: vi.fn(), findByCowId: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));
vi.mock('../repositories/weight.repository', () => ({ weightRepository: weights }));

import { WeightService } from './weight.service';

const service = new WeightService();
const cow = (id: string, weight: number) => ({ id, breed: 'B', age: '2', weight, healthStatus: 'Good', status: 'Active' });
// The repository returns an animal's weighings OLDEST FIRST (ORDER BY tracking_date ASC).
const weighing = (date: string, currentWeight: number, healthStatus = 'Good') => ({ cowId: 'CC-1', trackingDate: date, currentWeight, healthStatus });

beforeEach(() => {
  Object.values(stock).forEach(f => f.mockReset());
  Object.values(weights).forEach(f => f.mockReset());
  weights.create.mockImplementation(async (r: unknown) => r);
});

describe('WeightService.addWeightRecord', () => {
  it('saves the new weight on the animal and records the gain against its last weight', async () => {
    stock.findById.mockResolvedValue(cow('CC-1', 200));
    const saved = await service.addWeightRecord('CC-1', 250, 'Good', '2026-10-01');
    expect(stock.update).toHaveBeenCalledWith('CC-1', { weight: 250, healthStatus: 'Good' }, { tx: true });
    expect(saved).toMatchObject({ oldWeight: 200, currentWeight: 250, gainLoss: 0.25, trackingDate: '2026-10-01' });
  });

  it('records no gain for an animal with no earlier weight (no division by zero)', async () => {
    stock.findById.mockResolvedValue(cow('CC-1', 0));
    await expect(service.addWeightRecord('CC-1', 180, 'Good')).resolves.toMatchObject({ gainLoss: 0 });
  });

  it('refuses an unknown animal and writes nothing', async () => {
    stock.findById.mockResolvedValue(null);
    await expect(service.addWeightRecord('NOPE', 200, 'Good')).rejects.toThrow(/NOPE not found/);
    expect(stock.update).not.toHaveBeenCalled();
    expect(weights.create).not.toHaveBeenCalled();
  });
});

describe('WeightService.addWeightRecords (batch weighing)', () => {
  it('checks every animal before writing anything: one unknown animal saves none', async () => {
    stock.findByIds.mockResolvedValue([cow('CC-1', 200)]);
    await expect(service.addWeightRecords([
      { cowId: 'CC-1', currentWeight: 210, healthStatus: 'Good' },
      { cowId: 'CC-2', currentWeight: 220, healthStatus: 'Good' },
    ])).rejects.toThrow(/CC-2 not found/);
    expect(stock.update).not.toHaveBeenCalled();
    expect(weights.create).not.toHaveBeenCalled();
  });

  it('chains an animal listed twice: the second weighing starts from the first', async () => {
    stock.findByIds.mockResolvedValue([cow('CC-1', 200)]);
    const saved = await service.addWeightRecords([
      { cowId: 'CC-1', currentWeight: 220, healthStatus: 'Good' },
      { cowId: 'CC-1', currentWeight: 231, healthStatus: 'Good' },
    ]);
    expect(saved.map(r => [r.oldWeight, r.currentWeight])).toEqual([[200, 220], [220, 231]]);
  });

  it('does nothing for an empty list', async () => {
    await expect(service.addWeightRecords([])).resolves.toEqual([]);
    expect(stock.findByIds).not.toHaveBeenCalled();
  });
});

describe('WeightService.updateWeightRecord', () => {
  it("updates the animal's current weight when the LATEST weighing is corrected", async () => {
    weights.findByCowId.mockResolvedValue([weighing('2026-07-01', 180), weighing('2026-09-01', 240)]);
    await service.updateWeightRecord('CC-1', '2026-09-01', 245, 'Good');
    expect(stock.update).toHaveBeenCalledWith('CC-1', { weight: 245, healthStatus: 'Good' }, { tx: true });
  });

  it("leaves the animal's current weight alone when an OLDER weighing is corrected", async () => {
    weights.findByCowId.mockResolvedValue([weighing('2026-07-01', 180), weighing('2026-09-01', 240)]);
    await service.updateWeightRecord('CC-1', '2026-07-01', 185, 'Good');
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('matches the weighing by moment, whatever format the date arrives in', async () => {
    weights.findByCowId.mockResolvedValue([weighing('2026-09-01T00:00:00.000Z', 240)]);
    await service.updateWeightRecord('CC-1', '2026-09-01', 245, 'Good');
    expect(stock.update).toHaveBeenCalledTimes(1);
  });

  it('reads the history inside the same transaction, so it sees its own correction', async () => {
    weights.findByCowId.mockResolvedValue([weighing('2026-09-01', 240)]);
    await service.updateWeightRecord('CC-1', '2026-09-01', 245, 'Good');
    expect(weights.findByCowId).toHaveBeenCalledWith('CC-1', { tx: true });
  });
});

describe('WeightService.deleteWeightRecord', () => {
  it("puts the animal back on its latest REMAINING weighing", async () => {
    weights.delete.mockResolvedValue(true);
    // After deleting 2026-10-01, the remaining history (oldest first):
    weights.findByCowId.mockResolvedValue([weighing('2026-07-01', 180), weighing('2026-09-01', 240, 'Sick')]);
    await service.deleteWeightRecord('CC-1', '2026-10-01');
    expect(stock.update).toHaveBeenCalledWith('CC-1', { weight: 240, healthStatus: 'Sick' }, { tx: true });
  });

  it('reads the remaining history inside the transaction, so the deleted weighing is gone from it', async () => {
    weights.delete.mockResolvedValue(true);
    weights.findByCowId.mockResolvedValue([weighing('2026-07-01', 180)]);
    await service.deleteWeightRecord('CC-1', '2026-09-01');
    expect(weights.findByCowId).toHaveBeenCalledWith('CC-1', { tx: true });
  });

  it('changes nothing when the weighing was not found', async () => {
    weights.delete.mockResolvedValue(false);
    await expect(service.deleteWeightRecord('CC-1', '2026-01-01')).resolves.toBe(false);
    expect(stock.update).not.toHaveBeenCalled();
  });
});
