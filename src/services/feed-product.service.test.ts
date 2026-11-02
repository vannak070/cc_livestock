import { beforeEach, describe, expect, it, vi } from 'vitest';

const feed = vi.hoisted(() => ({ getProducts: vi.fn(), saveProduct: vi.fn(), deleteProduct: vi.fn() }));
vi.mock('../repositories/feed.repository', () => ({ feedRepository: feed }));

import { FeedProductService } from './feed-product.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new FeedProductService();
const office = { id: 'o', name: 'Office', role: 'Company', status: 'Active', permissions: ['feed_view', 'feed_manage'] } as UserRoleItem;
const owner = { id: 'f', name: 'Owner', role: 'Farm Owner', status: 'Active', farmLocation: 'SNR Farm', permissions: ['feed_view', 'feed_own_products'] } as UserRoleItem;
const staff = { id: 's', name: 'Staff', role: 'Farm Staff', status: 'Active', farmLocation: 'SNR Farm', permissions: ['feed_view', 'feed_record'] } as UserRoleItem;
const defaultFeed = { id: 'P-DEF', name: 'Cow Feed', ownerFarm: undefined };
const snrFeed = { id: 'P-SNR', name: 'SNR Grass', ownerFarm: 'SNR Farm' };
const otherFeed = { id: 'P-OTH', name: 'Other Grass', ownerFarm: 'CC_001' };

beforeEach(() => {
  Object.values(feed).forEach(f => f.mockReset());
  feed.getProducts.mockResolvedValue([defaultFeed, snrFeed, otherFeed]);
  feed.saveProduct.mockImplementation(async (p: unknown) => p);
});

describe('FeedProductService.save', () => {
  it("makes a farm owner's new product theirs, whatever farm the browser sent", async () => {
    const saved = await service.save(owner, { id: 'P-NEW', name: 'Rice straw', ownerFarm: 'CC_001' } as never);
    expect(saved.ownerFarm).toBe('SNR Farm');
  });

  it('makes a new office product a default for every farm', async () => {
    const saved = await service.save(office, { id: 'P-NEW', name: 'Mineral mix', ownerFarm: 'SNR Farm' } as never);
    expect(saved.ownerFarm).toBeUndefined();
  });

  it('keeps the owning farm when the office edits a farm product', async () => {
    const saved = await service.save(office, { ...snrFeed, name: 'SNR Grass (cut)', ownerFarm: undefined } as never);
    expect(saved.ownerFarm).toBe('SNR Farm');
  });

  it("refuses a farm owner changing the office's default product, with a 403 that says why", async () => {
    await expect(service.save(owner, { ...defaultFeed, name: 'Changed' } as never)).rejects.toMatchObject({ statusCode: 403, message: expect.stringMatching(/default product/) });
    expect(feed.saveProduct).not.toHaveBeenCalled();
  });

  it("refuses a farm owner changing another farm's product", async () => {
    await expect(service.save(owner, { ...otherFeed, name: 'Changed' } as never)).rejects.toBeInstanceOf(AuthzError);
  });

  it('refuses farm staff adding a product', async () => {
    await expect(service.save(staff, { id: 'P-NEW', name: 'X' } as never)).rejects.toBeInstanceOf(AuthzError);
    expect(feed.saveProduct).not.toHaveBeenCalled();
  });
});

describe('FeedProductService.remove', () => {
  it("lets a farm owner delete their own farm's product", async () => {
    await service.remove(owner, 'P-SNR');
    expect(feed.deleteProduct).toHaveBeenCalledWith('P-SNR');
  });

  it("refuses a farm owner deleting a default product", async () => {
    await expect(service.remove(owner, 'P-DEF')).rejects.toMatchObject({ statusCode: 403 });
    expect(feed.deleteProduct).not.toHaveBeenCalled();
  });

  it('does nothing for a product that is already gone', async () => {
    await service.remove(owner, 'P-GONE');
    expect(feed.deleteProduct).not.toHaveBeenCalled();
  });
});

describe('FeedProductService.assertCanMove', () => {
  const move = (productId: string, type: 'STOCK_IN' | 'STOCK_OUT', targetFarm: string) => ({ productId, type, targetFarm }) as never;

  it('lets the office move any feed anywhere', async () => {
    await expect(service.assertCanMove(office, move('P-DEF', 'STOCK_OUT', 'CC_001'))).resolves.toBeUndefined();
  });

  it("lets a farm owner put their own product into their own farm", async () => {
    await expect(service.assertCanMove(owner, move('P-SNR', 'STOCK_IN', 'SNR Farm'))).resolves.toBeUndefined();
  });

  it.each([
    ['a default product', move('P-DEF', 'STOCK_IN', 'SNR Farm')],
    ['feed taken out of stock', move('P-SNR', 'STOCK_OUT', 'SNR Farm')],
    ['feed sent to another farm', move('P-SNR', 'STOCK_IN', 'CC_001')],
  ])('refuses a farm owner moving %s', async (_label, tx) => {
    await expect(service.assertCanMove(owner, tx)).rejects.toMatchObject({ statusCode: 403 });
  });
});
