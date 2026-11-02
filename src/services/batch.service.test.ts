import { beforeEach, describe, expect, it, vi } from 'vitest';

const batches = vi.hoisted(() => ({ findById: vi.fn(), create: vi.fn(), assignCows: vi.fn(), moveToFarm: vi.fn() }));
const stockRepo = vi.hoisted(() => ({ findAll: vi.fn() }));
const stockSvc = vi.hoisted(() => ({ getAllStock: vi.fn() }));
const health = vi.hoisted(() => ({ addHealthLog: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn() }));
const limits = vi.hoisted(() => ({ assertRoom: vi.fn() }));
const guard = vi.hoisted(() => ({ notFarmBound: vi.fn(), cows: vi.fn(), batch: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: batches }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stockRepo }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));
vi.mock('./stock.service', () => ({ stockService: stockSvc }));
vi.mock('./health.service', () => ({ healthService: health }));
vi.mock('./weight.service', () => ({ weightService: { addWeightRecords: vi.fn() } }));
vi.mock('./farm-limit.service', () => ({ farmLimitService: limits }));
vi.mock('../lib/farm-guard', () => ({ farmGuard: guard }));

import { BatchService } from './batch.service';
import { BatchMoveService } from './batch-move.service';
import type { UserRoleItem } from '../lib/types';

const office = { id: 'u', name: 'Office', role: 'Company', status: 'Active' } as UserRoleItem;
const cow = (id: string, location: string, status = 'Active') => ({ id, location, status });

beforeEach(() => {
  [batches, stockRepo, stockSvc, health, settings, limits, guard].forEach(m => Object.values(m).forEach(f => f.mockReset()));
  batches.create.mockImplementation(async (b: unknown) => b);
});

describe('BatchService.createBatch', () => {
  const service = new BatchService();

  it('sets the selling target 90 days after the start when none is given', async () => {
    const batch = await service.createBatch({ id: 'B1', name: 'B1', type: 'Fattening', startDate: '2026-10-01', status: 'Active' } as never);
    expect(batch.sellingTargetDate).toBe('2026-12-30');
  });

  it('keeps a selling target the person chose', async () => {
    const batch = await service.createBatch({ id: 'B1', name: 'B1', type: 'Fattening', startDate: '2026-10-01', sellingTargetDate: '2026-11-15', status: 'Active' } as never);
    expect(batch.sellingTargetDate).toBe('2026-11-15');
  });
});

describe('BatchService.recordBatchHealthLog', () => {
  const service = new BatchService();

  it("logs the treatment for each of the batch's animals still on the farm", async () => {
    batches.findById.mockResolvedValue({ id: 'B1', cowIds: ['CC-1', 'CC-2'] });
    stockRepo.findAll.mockResolvedValue([cow('CC-1', 'SNR Farm'), cow('CC-2', 'SNR Farm', 'Sold'), cow('CC-3', 'SNR Farm')]);
    health.addHealthLog.mockImplementation(async (l: unknown) => l);
    const logs = await service.recordBatchHealthLog('B1', { date: '2026-10-10', type: 'Vaccine' } as never);
    expect(logs.map(l => l.cowId)).toEqual(['CC-1']);
  });
});

describe('BatchMoveService.moveToFarm', () => {
  const service = new BatchMoveService();
  beforeEach(() => {
    settings.getSettings.mockResolvedValue({ farms: [{ name: 'SNR Farm' }, { name: 'CC_001' }] });
    batches.findById.mockResolvedValue({ id: 'B1', farmLocation: 'SNR Farm', cowIds: ['CC-1', 'CC-2', 'CC-3'] });
    stockSvc.getAllStock.mockResolvedValue([cow('CC-1', 'SNR Farm'), cow('CC-2', 'SNR Farm'), cow('CC-3', 'SNR Farm', 'Sold')]);
    batches.moveToFarm.mockResolvedValue(2);
  });

  it("checks the new farm's cattle limit for the animals that move (sold ones do not count)", async () => {
    await expect(service.moveToFarm(office, 'B1', 'CC_001', true)).resolves.toEqual({ cattleMoved: 2 });
    expect(limits.assertRoom).toHaveBeenCalledWith('CC_001', 2);
    expect(batches.moveToFarm).toHaveBeenCalledWith('B1', 'CC_001', true, { tx: true });
  });

  it('moves nothing when the new farm has no room', async () => {
    limits.assertRoom.mockRejectedValue(new Error('CC_001 has used its cattle limit'));
    await expect(service.moveToFarm(office, 'B1', 'CC_001', true)).rejects.toThrow(/cattle limit/);
    expect(batches.moveToFarm).not.toHaveBeenCalled();
  });

  it('skips the limit check when only the batch moves, not its cattle', async () => {
    await service.moveToFarm(office, 'B1', 'CC_001', false);
    expect(limits.assertRoom).not.toHaveBeenCalled();
  });

  it('refuses a farm that is not on the list', async () => {
    await expect(service.moveToFarm(office, 'B1', 'Nowhere', true)).rejects.toThrow(/Choose a farm/);
    expect(batches.moveToFarm).not.toHaveBeenCalled();
  });

  it('does nothing when the batch is already on that farm', async () => {
    await expect(service.moveToFarm(office, 'B1', 'SNR Farm', true)).resolves.toEqual({ cattleMoved: 0 });
    expect(batches.moveToFarm).not.toHaveBeenCalled();
  });

  it('stops a farm account before anything is read', async () => {
    guard.notFarmBound.mockImplementation(() => { throw new Error('Only office accounts can do this.'); });
    await expect(service.moveToFarm(office, 'B1', 'CC_001', true)).rejects.toThrow(/office/);
    expect(settings.getSettings).not.toHaveBeenCalled();
  });
});

describe('BatchMoveService.moveCow', () => {
  const service = new BatchMoveService();
  const from = { id: 'B1', name: 'Batch 1', status: 'Active', farmLocation: 'SNR Farm', cowIds: ['CC-1'] };
  const to = { id: 'B2', name: 'Batch 2', status: 'Active', farmLocation: 'SNR Farm', cowIds: [] };
  beforeEach(() => {
    batches.findById.mockImplementation(async (id: string) => ({ B1: from, B2: to })[id as 'B1' | 'B2'] ?? null);
    stockSvc.getAllStock.mockResolvedValue([cow('CC-1', 'SNR Farm')]);
  });

  it('moves an animal on the farm into another active batch on the same farm', async () => {
    await service.moveCow(office, 'CC-1', 'B1', 'B2');
    expect(batches.assignCows).toHaveBeenCalledWith('B2', ['CC-1'], { tx: true });
  });

  it.each([
    ['the same batch', 'B1', /different batch/],
    ['a closed batch', 'B2', /closed/],
  ])('refuses %s', async (_label, toId, message) => {
    if (toId === 'B2') batches.findById.mockImplementation(async (id: string) => ({ B1: from, B2: { ...to, status: 'Closed' } })[id as 'B1' | 'B2']);
    await expect(service.moveCow(office, 'CC-1', 'B1', toId)).rejects.toThrow(message);
    expect(batches.assignCows).not.toHaveBeenCalled();
  });

  it('refuses a batch on another farm', async () => {
    batches.findById.mockImplementation(async (id: string) => ({ B1: from, B2: { ...to, farmLocation: 'CC_001' } })[id as 'B1' | 'B2']);
    await expect(service.moveCow(office, 'CC-1', 'B1', 'B2')).rejects.toThrow(/is on CC_001/);
  });

  it('refuses a sold animal', async () => {
    stockSvc.getAllStock.mockResolvedValue([cow('CC-1', 'SNR Farm', 'Sold')]);
    await expect(service.moveCow(office, 'CC-1', 'B1', 'B2')).rejects.toThrow(/still on the farm/);
  });

  it('refuses when the animal has already left the first batch (another person moved it)', async () => {
    batches.findById.mockImplementation(async (id: string) => ({ B1: { ...from, cowIds: [] }, B2: to })[id as 'B1' | 'B2']);
    await expect(service.moveCow(office, 'CC-1', 'B1', 'B2')).rejects.toThrow(/no longer in this batch/);
  });
});
