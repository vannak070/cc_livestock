import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ cleanup: vi.fn(), claim: vi.fn(), confirm: vi.fn(), release: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn(), patchBlob: vi.fn() }));
const repo = vi.hoisted(() => ({ findAll: vi.fn(), getProducts: vi.fn(), getTransactions: vi.fn() }));
const telegram = vi.hoisted(() => ({ isConfigured: vi.fn(), send: vi.fn() }));
vi.mock('../repositories/daily-alert-log.repository', () => ({ dailyAlertLogRepository: log }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: repo }));
vi.mock('../repositories/weight.repository', () => ({ weightRepository: { findAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: { findAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../repositories/feed.repository', () => ({ feedRepository: { getProducts: repo.getProducts, getTransactions: repo.getTransactions } }));
vi.mock('../repositories/follow-up.repository', () => ({ followUpRepository: { findAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('./telegram.service', () => ({ telegramService: telegram }));

import { DailyAlertService } from './daily-alert.service';

const service = new DailyAlertService();
const ON = { alerts: { telegramEnabled: true, chatId: '-1001234567', sendHour: 7 } };
const MORNING = new Date('2026-10-06T02:00:00Z'); // 09:00 farm time
const EARLY = new Date('2026-10-05T22:00:00Z'); // 05:00 farm time

describe('DailyAlertService.run', () => {
  beforeEach(() => {
    [log, settings, repo, telegram].forEach(o => Object.values(o).forEach(f => f.mockReset()));
    repo.findAll.mockResolvedValue([{ id: 'A1', status: 'Active', location: 'SNR Farm', sex: 'M', healthStatus: 'sick' }]);
    repo.getProducts.mockResolvedValue([]);
    repo.getTransactions.mockResolvedValue([]);
    settings.getSettings.mockResolvedValue(ON);
    telegram.isConfigured.mockReturnValue(true);
    telegram.send.mockResolvedValue(undefined);
    log.claim.mockResolvedValue(3);
  });

  it('sends the morning check-up once the alert hour has come, and confirms it', async () => {
    await expect(service.run({ now: MORNING })).resolves.toEqual({ sent: 1 });
    expect(log.claim).toHaveBeenCalledWith('2026-10-06', 'morning');
    expect(telegram.send).toHaveBeenCalledWith('-1001234567', expect.stringContaining('1 animal is unwell: A1'));
    expect(log.confirm).toHaveBeenCalledWith(3);
  });

  it('waits for the alert hour', async () => {
    await expect(service.run({ now: EARLY })).resolves.toEqual({ sent: 0, skipped: 'not-due' });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('does not send twice the same day', async () => {
    log.claim.mockResolvedValue(null);
    await expect(service.run({ now: MORNING })).resolves.toEqual({ sent: 0, skipped: 'nothing-new' });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('gives the claim back when Telegram fails, so the next check tries again', async () => {
    telegram.send.mockRejectedValue(new Error('down'));
    await expect(service.run({ now: MORNING })).rejects.toThrow('down');
    expect(log.release).toHaveBeenCalledWith(3);
    expect(log.confirm).not.toHaveBeenCalled();
  });

  it('is off when alerts are off', async () => {
    settings.getSettings.mockResolvedValue({ alerts: { telegramEnabled: false, chatId: '-1001234567' } });
    await expect(service.run({ now: MORNING })).resolves.toEqual({ sent: 0, skipped: 'not-due' });
  });
});
