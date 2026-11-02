import { beforeEach, describe, expect, it, vi } from 'vitest';

const logs = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), delete: vi.fn(), findById: vi.fn(), latestStatusLog: vi.fn(), latestStatusLogDate: vi.fn() }));
const stock = vi.hoisted(() => ({ findById: vi.fn(), update: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/health.repository', () => ({ healthRepository: logs }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));

import { HealthService } from './health.service';

const service = new HealthService();
const log = (type: string, date: string, id = 'HL-1') => ({ id, cowId: 'CC-1', type, name: 'x', date, administeredBy: '', cost: 0 });

beforeEach(() => {
  Object.values(logs).forEach(f => f.mockReset());
  Object.values(stock).forEach(f => f.mockReset());
  stock.findById.mockResolvedValue({ id: 'CC-1', healthStatus: 'Good' });
  logs.latestStatusLogDate.mockResolvedValue(null); // no other disease/treatment records unless a test says so
});

describe('HealthService.addHealthLog', () => {
  it('marks the animal Poor when a disease is recorded', async () => {
    logs.create.mockResolvedValue(log('Disease', '2026-10-10T00:00:00.000Z'));
    await service.addHealthLog(log('Disease', '2026-10-10T00:00:00.000Z') as never);
    expect(stock.update).toHaveBeenCalledWith('CC-1', { healthStatus: 'Poor' }, { tx: true });
  });

  it('marks the animal Good when a treatment is recorded', async () => {
    logs.create.mockResolvedValue(log('Treatment', '2026-10-11T00:00:00.000Z'));
    await service.addHealthLog(log('Treatment', '2026-10-11T00:00:00.000Z') as never);
    expect(stock.update).toHaveBeenCalledWith('CC-1', { healthStatus: 'Good' }, { tx: true });
  });

  it.each(['Vaccination', 'Deworming'])('leaves the health status alone for a %s', async type => {
    logs.create.mockResolvedValue(log(type, '2026-10-11T00:00:00.000Z'));
    await service.addHealthLog(log(type, '2026-10-11T00:00:00.000Z') as never);
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('does not let a record about the past undo what a newer disease or treatment says', async () => {
    // Treated on 10 Oct (animal Good); today someone writes down a disease from 1 Oct.
    logs.latestStatusLogDate.mockResolvedValue(new Date('2026-10-10T00:00:00.000Z'));
    logs.create.mockResolvedValue(log('Disease', '2026-10-01T00:00:00.000Z', 'HL-2'));
    await service.addHealthLog(log('Disease', '2026-10-01T00:00:00.000Z', 'HL-2') as never);
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('lets a record on the same day as the latest one decide (the newest entry wins a tie)', async () => {
    logs.latestStatusLogDate.mockResolvedValue(new Date('2026-10-10T00:00:00.000Z'));
    logs.create.mockResolvedValue(log('Treatment', '2026-10-10T00:00:00.000Z', 'HL-2'));
    await service.addHealthLog(log('Treatment', '2026-10-10T00:00:00.000Z', 'HL-2') as never);
    expect(stock.update).toHaveBeenCalledWith('CC-1', { healthStatus: 'Good' }, { tx: true });
  });

  it('does nothing to stock for an animal that is not there (no crash)', async () => {
    stock.findById.mockResolvedValue(null);
    logs.create.mockResolvedValue(log('Disease', '2026-10-10T00:00:00.000Z'));
    await expect(service.addHealthLog(log('Disease', '2026-10-10T00:00:00.000Z') as never)).resolves.toBeDefined();
    expect(stock.update).not.toHaveBeenCalled();
  });
});

describe('HealthService.updateHealthLog', () => {
  it("fixing a typo in an OLD disease record does not make a treated animal sick again", async () => {
    logs.latestStatusLogDate.mockResolvedValue(new Date('2026-10-10T00:00:00.000Z')); // a newer treatment exists
    logs.update.mockResolvedValue(log('Disease', '2026-10-01T00:00:00.000Z', 'HL-OLD'));
    await service.updateHealthLog('HL-OLD', { notes: 'typo fixed' });
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('editing the newest disease or treatment record keeps the status in step with it', async () => {
    logs.update.mockResolvedValue(log('Disease', '2026-10-12T00:00:00.000Z'));
    await service.updateHealthLog('HL-1', { notes: 'worse' });
    expect(stock.update).toHaveBeenCalledWith('CC-1', { healthStatus: 'Poor' }, { tx: true });
  });

  it('ignores the record itself when looking for a newer one', async () => {
    logs.update.mockResolvedValue(log('Disease', '2026-10-12T00:00:00.000Z', 'HL-9'));
    await service.updateHealthLog('HL-9', {});
    expect(logs.latestStatusLogDate).toHaveBeenCalledWith('CC-1', 'HL-9', { tx: true });
  });

  it('does not touch the health status for a vaccination', async () => {
    logs.update.mockResolvedValue(log('Vaccination', '2026-10-12T00:00:00.000Z'));
    await service.updateHealthLog('HL-1', { notes: 'second dose' });
    expect(stock.update).not.toHaveBeenCalled();
  });
});

describe('HealthService.deleteHealthLog', () => {
  it('removes the record', async () => {
    logs.delete.mockResolvedValue(true);
    logs.findById.mockResolvedValue(log('Vaccination', '2026-10-01'));
    await expect(service.deleteHealthLog('HL-1')).resolves.toBe(true);
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('clears the sick status when the deleted Disease record was the only one', async () => {
    logs.delete.mockResolvedValue(true);
    logs.findById.mockResolvedValue(log('Disease', '2026-10-01'));
    logs.latestStatusLog.mockResolvedValue(null);
    stock.findById.mockResolvedValue({ id: 'CC-1', healthStatus: 'Poor' });
    await service.deleteHealthLog('HL-1');
    expect(stock.update).toHaveBeenCalledWith('CC-1', { healthStatus: 'Good' }, expect.anything());
  });

  it('goes back to what the newest remaining record says', async () => {
    logs.delete.mockResolvedValue(true);
    logs.findById.mockResolvedValue(log('Treatment', '2026-10-05'));
    logs.latestStatusLog.mockResolvedValue({ type: 'Disease', date: new Date('2026-10-01') });
    stock.findById.mockResolvedValue({ id: 'CC-1', healthStatus: 'Good' });
    await service.deleteHealthLog('HL-1');
    expect(stock.update).toHaveBeenCalledWith('CC-1', { healthStatus: 'Poor' }, expect.anything());
  });

  it('leaves a status that was not set by these records alone', async () => {
    logs.delete.mockResolvedValue(true);
    logs.findById.mockResolvedValue(log('Disease', '2026-10-01'));
    logs.latestStatusLog.mockResolvedValue(null);
    stock.findById.mockResolvedValue({ id: 'CC-1', healthStatus: 'Good' });
    await service.deleteHealthLog('HL-1');
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('does nothing to the animal when no record was deleted', async () => {
    logs.delete.mockResolvedValue(false);
    logs.findById.mockResolvedValue(null);
    await expect(service.deleteHealthLog('HL-9')).resolves.toBe(false);
    expect(stock.update).not.toHaveBeenCalled();
  });
});
