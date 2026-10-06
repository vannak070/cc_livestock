import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ cleanup: vi.fn(), sent: vi.fn(), claim: vi.fn(), confirm: vi.fn(), markPassed: vi.fn(), release: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn(), patchBlob: vi.fn() }));
const stock = vi.hoisted(() => ({ findAll: vi.fn() }));
const telegram = vi.hoisted(() => ({ isConfigured: vi.fn(), sendingAllowedHere: vi.fn(), send: vi.fn() }));
vi.mock('../repositories/capacity-alert-log.repository', () => ({ capacityAlertLogRepository: log }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));
vi.mock('./telegram.service', () => ({ telegramService: telegram }));

import { CapacityAlertService } from './capacity-alert.service';

const service = new CapacityAlertService();
const cows = (farm: string, n: number) => Array.from({ length: n }, () => ({ location: farm }));
const ON = { alerts: { telegramEnabled: true, chatId: '-1001234567' }, farms: [{ id: '1', name: 'SNR Farm', capacity: 100 }, { id: '2', name: 'Quiet', capacity: 100 }] };

describe('CapacityAlertService.run', () => {
  beforeEach(() => {
    Object.values(log).forEach(f => f.mockReset());
    Object.values(settings).forEach(f => f.mockReset());
    Object.values(telegram).forEach(f => f.mockReset());
    stock.findAll.mockReset().mockResolvedValue([...cows('SNR Farm', 90), ...cows('Quiet', 10)]);
    settings.getSettings.mockResolvedValue(ON);
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendingAllowedHere.mockReturnValue(true);
    telegram.send.mockResolvedValue(undefined);
    log.sent.mockResolvedValue([]);
    log.claim.mockResolvedValue(7);
  });

  it('sends one warning for the farm at 90%, confirms it, and marks the lower steps passed', async () => {
    await expect(service.run()).resolves.toEqual({ sent: 1 });
    expect(telegram.send).toHaveBeenCalledTimes(1);
    expect(telegram.send).toHaveBeenCalledWith('-1001234567', expect.stringContaining('<b>SNR Farm</b> has used 90% of its cattle limit'));
    expect(log.claim).toHaveBeenCalledWith('SNR Farm', 100, 90);
    expect(log.confirm).toHaveBeenCalledWith(7);
    expect(log.markPassed).toHaveBeenCalledWith('SNR Farm', 100, 90);
  });

  it('sends nothing for a step already sent', async () => {
    log.sent.mockResolvedValue([{ farm: 'SNR Farm', limit: 100, step: 90 }]);
    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 'nothing-new' });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('does not send when another server claimed it first', async () => {
    log.claim.mockResolvedValue(null);
    await expect(service.run()).resolves.toMatchObject({ sent: 0 });
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('stays quiet without a token, on a server not meant to send, or while alerts are off', async () => {
    telegram.isConfigured.mockReturnValue(false);
    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 'no-token' });
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendingAllowedHere.mockReturnValue(false);
    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 'off' });
    telegram.sendingAllowedHere.mockReturnValue(true);
    settings.getSettings.mockResolvedValue({ ...ON, alerts: { telegramEnabled: false, chatId: '-1001234567' } });
    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 'off' });
    expect(telegram.send).not.toHaveBeenCalled();
    expect(log.claim).not.toHaveBeenCalled();
  });

  it('gives the claim back when Telegram fails, so the next check tries again, and reports the error', async () => {
    telegram.send.mockRejectedValue(new Error('Telegram could not be reached'));
    await expect(service.run()).rejects.toThrow(/could not be reached/);
    expect(log.release).toHaveBeenCalledWith(7);
    expect(log.confirm).not.toHaveBeenCalled();
    expect(settings.patchBlob).toHaveBeenCalledWith({ alertStatus: expect.objectContaining({ lastError: 'Telegram could not be reached' }) });
  });

  it('force (the Check and send now button) refuses with a clear message when alerts are off', async () => {
    settings.getSettings.mockResolvedValue({ ...ON, alerts: { telegramEnabled: false, chatId: '' } });
    await expect(service.run({ force: true })).rejects.toThrow(/Switch alerts on/);
  });
});
