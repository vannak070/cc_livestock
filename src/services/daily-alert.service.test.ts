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
const ON = { alerts: { telegramEnabled: true, chatId: '-1001234567', sendHour: 7 }, farms: [{ id: '1', name: 'SNR Farm' }, { id: '2', name: 'Pursat' }] };
const MORNING = new Date('2026-10-06T02:00:00Z'); // 09:00 farm time
const EARLY = new Date('2026-10-05T22:00:00Z'); // 05:00 farm time
const cow = (id: string, farm: string, extra: Record<string, unknown> = {}) => ({ id, status: 'Active', location: farm, sex: 'M', healthStatus: 'healthy', ...extra });
const NO_PAUSE = { pauseMs: 0 };

describe('DailyAlertService.run', () => {
  beforeEach(() => {
    [log, settings, repo, telegram].forEach(o => Object.values(o).forEach(f => f.mockReset()));
    repo.findAll.mockResolvedValue([cow('A1', 'SNR Farm', { purchaseDate: '2026-01-01' }), cow('P1', 'Pursat')]);
    repo.getProducts.mockResolvedValue([]);
    repo.getTransactions.mockResolvedValue([]);
    settings.getSettings.mockResolvedValue(ON);
    telegram.isConfigured.mockReturnValue(true);
    telegram.send.mockResolvedValue(undefined);
    log.claim.mockResolvedValue(3);
  });

  it('sends each farm its own message in the morning, so people only read their own farm', async () => {
    repo.findAll.mockResolvedValue([cow('A1', 'SNR Farm', { purchaseDate: '2026-01-01' }), cow('P1', 'Pursat', { purchaseDate: '2026-01-01' })]);
    const run = await service.run({ now: MORNING, ...NO_PAUSE });
    expect(run).toEqual({ sent: 2 });
    expect(log.claim).toHaveBeenCalledWith('2026-10-06', 'longstay:Pursat');
    expect(log.claim).toHaveBeenCalledWith('2026-10-06', 'longstay:SNR Farm');
    const texts = telegram.send.mock.calls.map(c => c[1] as string);
    const snr = texts.find(t => t.includes('Long time on the farm · SNR Farm'));
    expect(snr).toContain('A1 (9 months)');
    expect(snr).not.toContain('P1');
    expect(texts.find(t => t.includes('Long time on the farm · Pursat'))).toContain('P1 (9 months)');
    expect(log.confirm).toHaveBeenCalledTimes(2);
  });

  it('sends nothing on a day with nothing to report: there is no daily report', async () => {
    repo.findAll.mockResolvedValue([cow('A1', 'SNR Farm', { healthStatus: 'sick' }), cow('P1', 'Pursat')]);
    await expect(service.run({ now: MORNING, ...NO_PAUSE })).resolves.toEqual({ sent: 0, skipped: 'nothing-new' });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('waits for the alert hour', async () => {
    await expect(service.run({ now: EARLY, ...NO_PAUSE })).resolves.toEqual({ sent: 0, skipped: 'not-due' });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('does not send a farm\'s message twice the same day', async () => {
    log.claim.mockResolvedValue(null);
    await expect(service.run({ now: MORNING, ...NO_PAUSE })).resolves.toEqual({ sent: 0, skipped: 'nothing-new' });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('gives the claim back when Telegram fails, so the next check tries again', async () => {
    telegram.send.mockRejectedValue(new Error('down'));
    await expect(service.run({ now: MORNING, ...NO_PAUSE })).rejects.toThrow('down');
    expect(log.release).toHaveBeenCalledWith(3);
    expect(log.confirm).not.toHaveBeenCalled();
  });

  it('is off when alerts are off', async () => {
    settings.getSettings.mockResolvedValue({ alerts: { telegramEnabled: false, chatId: '-1001234567' } });
    await expect(service.run({ now: MORNING, ...NO_PAUSE })).resolves.toEqual({ sent: 0, skipped: 'not-due' });
  });

  it('sends at most 15 messages per check; the rest follow on the next one', async () => {
    const farms = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `Farm ${i}` }));
    settings.getSettings.mockResolvedValue({ ...ON, farms });
    repo.findAll.mockResolvedValue(farms.map((f, i) => cow(`C${i}`, f.name, { purchaseDate: '2026-01-01' })));
    await expect(service.run({ now: MORNING, ...NO_PAUSE })).resolves.toEqual({ sent: 15 });
  });
});
