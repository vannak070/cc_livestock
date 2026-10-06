import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ cleanup: vi.fn(), sent: vi.fn(), claim: vi.fn(), confirm: vi.fn(), release: vi.fn(), rearm: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn(), patchBlob: vi.fn() }));
const stock = vi.hoisted(() => ({ findAll: vi.fn() }));
const batches = vi.hoisted(() => ({ findAll: vi.fn() }));
const feed = vi.hoisted(() => ({ getProducts: vi.fn(), getTransactions: vi.fn() }));
const telegram = vi.hoisted(() => ({ isConfigured: vi.fn(), sendingAllowedHere: vi.fn(), send: vi.fn() }));
vi.mock('../repositories/low-feed-alert-log.repository', () => ({ lowFeedAlertLogRepository: log }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: batches }));
vi.mock('../repositories/feed.repository', () => ({ feedRepository: feed }));
vi.mock('./telegram.service', () => ({ telegramService: telegram }));

import { LowFeedAlertService } from './low-feed-alert.service';

const service = new LowFeedAlertService();
const product = { id: 'P1', name: 'DSR-16 Cow Feed', category: 'Concentrate', unit: 'bag', weightPerUnit: 30, unitCost: 1, minThresholdBags: 50, minThresholdKg: 1500, status: 'Active' };
const stockIn = (bags: number) => ({ id: 'T1', date: '2026-10-01T00:00:00.000Z', productId: 'P1', productName: product.name, type: 'STOCK_IN', quantityBags: bags, quantityKg: bags * 30, unitCost: 1, totalCost: 1, sourceFarm: 'Supplier', targetFarm: 'Farm A' });
const ON = { alerts: { telegramEnabled: true, chatId: '-1001234567' }, farms: [{ id: '1', name: 'Farm A' }] };

describe('LowFeedAlertService.run', () => {
  beforeEach(() => {
    Object.values(log).forEach(f => f.mockReset());
    Object.values(settings).forEach(f => f.mockReset());
    Object.values(telegram).forEach(f => f.mockReset());
    stock.findAll.mockReset().mockResolvedValue([{ id: 'A1', location: 'Farm A', status: 'Active' }]);
    batches.findAll.mockReset().mockResolvedValue([{ id: 'BA', name: 'BA', status: 'Active', farmLocation: 'Farm A', cowIds: ['A1'], feedingProgram: { status: 'Active', ingredients: [{ name: product.name, productId: 'P1', portionPerHead: 6 }] } }]);
    feed.getProducts.mockReset().mockResolvedValue([product]);
    feed.getTransactions.mockReset().mockResolvedValue([stockIn(40)]);
    settings.getSettings.mockResolvedValue(ON);
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendingAllowedHere.mockReturnValue(true);
    telegram.send.mockResolvedValue(undefined);
    log.sent.mockResolvedValue([]);
    log.claim.mockResolvedValue(7);
  });

  it('sends one alert for the low feed and confirms it', async () => {
    await expect(service.run()).resolves.toEqual({ sent: 1 });
    expect(telegram.send).toHaveBeenCalledWith('-1001234567', expect.stringContaining('<b>Low feed · Farm A</b>'));
    expect(log.claim).toHaveBeenCalledWith('Farm A', 'P1');
    expect(log.confirm).toHaveBeenCalledWith(7);
  });

  it('sends nothing for a feed already announced, and does not re-arm while it is still low', async () => {
    log.sent.mockResolvedValue([{ farm: 'Farm A', productId: 'P1' }]);
    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 'nothing-new' });
    expect(telegram.send).not.toHaveBeenCalled();
    expect(log.rearm).not.toHaveBeenCalled();
  });

  it('arms the feed again once it is restocked, then alerts again on the next drop', async () => {
    feed.getTransactions.mockResolvedValue([stockIn(500)]);
    log.sent.mockResolvedValue([{ farm: 'Farm A', productId: 'P1' }]);
    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 'nothing-new' });
    expect(log.rearm).toHaveBeenCalledWith('Farm A', 'P1');
  });

  it('gives the claim back when Telegram fails, so the next check tries again', async () => {
    telegram.send.mockRejectedValue(new Error('Telegram down'));
    await expect(service.run()).rejects.toThrow('Telegram down');
    expect(log.release).toHaveBeenCalledWith(7);
    expect(log.confirm).not.toHaveBeenCalled();
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
  });

  it('a forced run refuses to go ahead while alerts are off', async () => {
    settings.getSettings.mockResolvedValue({ ...ON, alerts: { telegramEnabled: false, chatId: '' } });
    await expect(service.run({ force: true })).rejects.toThrow('Switch alerts on');
  });
});
