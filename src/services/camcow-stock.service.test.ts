import { beforeEach, describe, expect, it, vi } from 'vitest';

const buyers = vi.hoisted(() => ({ buyers: vi.fn(), buyer: vi.fn(), insertBuyer: vi.fn(), updateBuyer: vi.fn() }));
const costs = vi.hoisted(() => ({ all: vi.fn(), find: vi.fn(), insert: vi.fn(), remove: vi.fn() }));
const repo = vi.hoisted(() => ({ all: vi.fn(), lock: vi.fn(), salesOf: vi.fn(), insert: vi.fn(), markSold: vi.fn(), markLost: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/camcow-cost.repository', () => ({ camcowCostRepository: costs }));
vi.mock('../repositories/camcow-buyer.repository', () => ({ camcowBuyerRepository: buyers }));
vi.mock('../repositories/camcow-holding.repository', () => ({ camcowHoldingRepository: repo }));

import { CamcowStockService } from './camcow-stock.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new CamcowStockService();
const person = (role: string) => ({ id: role, name: `${role} Person`, email: 'p@x.test', role, status: 'Active' }) as UserRoleItem;
const admin = person('Admin');
const held = (cowId: string) => ({ cowId, sourceFarm: 'A', collectedOn: '2026-10-01', collectionWeight: 400, collectionTotal: 5_000_000, status: 'Held', note: '' });

beforeEach(() => {
  [...Object.values(repo), ...Object.values(buyers), ...Object.values(costs)].forEach(f => f.mockReset());
  repo.insert.mockResolvedValue(true);
  buyers.buyer.mockResolvedValue({ id: 'BUY-1', name: 'Meat Co', kind: 'slaughterhouse', phone: '', location: '', note: '', active: true });
});

describe('who may do what', () => {
  it('lets Management read but not change', async () => {
    repo.all.mockResolvedValue([]); buyers.buyers.mockResolvedValue([]); costs.all.mockResolvedValue([]);
    await expect(service.view(person('Management'))).resolves.toEqual({ holdings: [], buyers: [], costs: [] });
    await expect(service.receive(person('Management'), ['1'])).rejects.toBeInstanceOf(AuthzError);
    await expect(service.sell(person('Management'), { cowIds: ['1'], buyerId: 'BUY-1', date: '2026-10-01', pricePerKg: 1, weights: { '1': 1 } })).rejects.toBeInstanceOf(AuthzError);
    await expect(service.markLost(person('Management'), ['1'], '2026-10-01', '')).rejects.toBeInstanceOf(AuthzError);
  });
  it.each(['Company', 'Farm Owner', 'Farm Staff', 'Veterinarian'])('a %s cannot see the stock', async role => {
    await expect(service.view(person(role))).rejects.toBeInstanceOf(AuthzError);
  });
});

describe('receive', () => {
  it('brings in animals that were sold to CC Livestock, and counts only the new ones', async () => {
    repo.salesOf.mockResolvedValue([{ cowId: '1', farm: 'A', buyer: 'CC Livestock', salesDate: '2026-10-05', weight: 410, total: 5_125_000 }, { cowId: '2', farm: 'A', buyer: 'cc livestock', salesDate: '2026-10-05', weight: 400, total: 5_000_000 }]);
    repo.insert.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.receive(admin, ['1', '2', '1'])).resolves.toEqual({ received: 1 });
    expect(repo.insert).toHaveBeenCalledTimes(2);
  });
  it('refuses an animal that was sold to someone else', async () => {
    repo.salesOf.mockResolvedValue([{ cowId: '1', farm: 'A', buyer: 'Kampot traders', salesDate: '2026-10-05', weight: 400, total: 5_000_000 }]);
    await expect(service.receive(admin, ['1'])).rejects.toThrow(/not been sold to CC Livestock/);
    expect(repo.insert).not.toHaveBeenCalled();
  });
  it('needs at least one animal', async () => {
    await expect(service.receive(admin, [])).rejects.toThrow(/Choose/);
  });
});

describe('sell and lost', () => {
  it('sells animals in stock by scale and totals the money', async () => {
    repo.lock.mockResolvedValue([held('1'), held('2')]);
    const r = await service.sell(admin, { cowIds: ['1', '2'], buyerId: 'BUY-1', date: '2026-10-01', pricePerKg: 13_000, weights: { '1': 410, '2': 400 } });
    expect(r).toEqual({ sold: 2, total: 410 * 13_000 + 400 * 13_000 });
    expect(repo.markSold).toHaveBeenCalledWith('1', { soldOn: '2026-10-01', buyerId: 'BUY-1', buyer: 'Meat Co', weight: 410, pricePerKg: 13_000, total: 5_330_000 }, 'Admin Person', expect.anything());
  });
  it('refuses a buyer that is unknown or not active', async () => {
    repo.lock.mockResolvedValue([held('1')]);
    const sale = { cowIds: ['1'], buyerId: 'BUY-1', date: '2026-10-01', pricePerKg: 13_000, weights: { '1': 410 } };
    buyers.buyer.mockResolvedValueOnce(null);
    await expect(service.sell(admin, sale)).rejects.toThrow(/not found/);
    buyers.buyer.mockResolvedValueOnce({ id: 'BUY-1', name: 'Meat Co', active: false });
    await expect(service.sell(admin, sale)).rejects.toThrow(/not active/);
    expect(repo.markSold).not.toHaveBeenCalled();
  });
  it('does not sell an animal that is already sold or not in stock', async () => {
    repo.lock.mockResolvedValue([{ ...held('1'), status: 'Sold' }]);
    await expect(service.sell(admin, { cowIds: ['1'], buyerId: 'BUY-1', date: '2026-10-01', pricePerKg: 13_000, weights: { '1': 410 } })).rejects.toThrow(/not in stock/);
    expect(repo.markSold).not.toHaveBeenCalled();
  });
  it('marks animals in stock as lost', async () => {
    repo.lock.mockResolvedValue([held('1')]);
    await expect(service.markLost(admin, ['1'], '2026-10-01', ' died ')).resolves.toEqual({ lost: 1 });
    expect(repo.markLost).toHaveBeenCalledWith('1', '2026-10-01', 'died', 'Admin Person', expect.anything());
  });
});

describe('buyers', () => {
  it('adds a buyer and refuses a second with the same name', async () => {
    buyers.buyers.mockResolvedValue([{ id: 'BUY-1', name: 'Meat Co' }]);
    buyers.insertBuyer.mockResolvedValue({ id: 'BUY-2', name: 'Kampot Traders' });
    await expect(service.saveBuyer(admin, { name: ' Kampot Traders ', kind: 'trader' })).resolves.toMatchObject({ id: 'BUY-2' });
    await expect(service.saveBuyer(admin, { name: 'meat co', kind: 'trader' })).rejects.toThrow(/already a buyer/);
    await expect(service.saveBuyer(person('Management'), { name: 'X', kind: 'trader' })).rejects.toBeInstanceOf(AuthzError);
  });
  it('lets a buyer keep its own name when it is edited', async () => {
    buyers.buyers.mockResolvedValue([{ id: 'BUY-1', name: 'Meat Co' }]);
    buyers.buyer.mockResolvedValue({ id: 'BUY-1', name: 'Meat Co' });
    await expect(service.saveBuyer(admin, { id: 'BUY-1', name: 'Meat Co', kind: 'trader', phone: '012' })).resolves.toBeDefined();
    expect(buyers.updateBuyer).toHaveBeenCalled();
  });
});

describe('costs of the stock site', () => {
  const ok = { date: '2026-10-01', kind: 'feed' as const, amount: 150_000, note: ' hay ' };
  it('records a cost', async () => {
    await service.addCost(admin, ok);
    expect(costs.insert).toHaveBeenCalledWith(ok, 'Admin Person');
  });
  it('refuses a bad cost and Management cannot record one', async () => {
    await expect(service.addCost(admin, { ...ok, amount: 0 })).rejects.toThrow(/amount/);
    await expect(service.addCost(person('Management'), ok)).rejects.toBeInstanceOf(AuthzError);
    expect(costs.insert).not.toHaveBeenCalled();
  });
  it('removes a cost, or says it was not found', async () => {
    costs.find.mockResolvedValueOnce({ id: 'CST-1' });
    await service.deleteCost(admin, 'CST-1');
    expect(costs.remove).toHaveBeenCalledWith('CST-1');
    costs.find.mockResolvedValueOnce(null);
    await expect(service.deleteCost(admin, 'CST-9')).rejects.toThrow(/not found/);
  });
});
