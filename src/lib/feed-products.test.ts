import { describe, expect, it } from 'vitest';
import { canAddProduct, canEditProduct, isDefaultProduct, productsForFarm } from './feed-products';
import { scopeDataToFarm } from './farm-view';
import type { ERPLivestockData } from './types';

const owner = { role: 'Farm Owner', farmLocation: 'SNR Farm', permissions: ['feed_view', 'feed_own_products'] };
const staff = { role: 'Farm Staff', farmLocation: 'SNR Farm', permissions: ['feed_view', 'feed_record'] };
const office = { role: 'Company', permissions: ['feed_view', 'feed_manage'] };
const dsr = { ownerFarm: undefined };
const mine = { ownerFarm: 'SNR Farm' };
const theirs = { ownerFarm: 'Other Farm' };

describe('feed product rules', () => {
  it('default products are locked for a farm owner but open to the office', () => {
    expect(isDefaultProduct(dsr)).toBe(true);
    expect(canEditProduct(owner, dsr)).toBe(false);
    expect(canEditProduct(office, dsr)).toBe(true);
    expect(canEditProduct({ role: 'Admin' }, dsr)).toBe(true);
  });

  it('a farm owner edits only their own farm products', () => {
    expect(canEditProduct(owner, mine)).toBe(true);
    expect(canEditProduct(owner, theirs)).toBe(false);
  });

  it('farm staff change no products and cannot add', () => {
    expect(canEditProduct(staff, mine)).toBe(false);
    expect(canAddProduct(staff)).toBe(false);
    expect(canAddProduct(owner)).toBe(true);
    expect(canAddProduct(office)).toBe(true);
    expect(canAddProduct({ role: 'Farm Owner', permissions: ['feed_own_products'] })).toBe(false); // no farm
  });

  it('a farm sees the defaults and its own products only', () => {
    const all = [{ id: 'a', ...dsr }, { id: 'b', ...mine }, { id: 'c', ...theirs }];
    expect(productsForFarm(all, 'SNR Farm').map(p => p.id)).toEqual(['a', 'b']);
    expect(productsForFarm(all).map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('scopeDataToFarm narrows feed products too', () => {
    const data = {
      stock: [], batches: [], weightTracking: [], healthLogs: [], salesTracking: [], farmCosts: [], common: {},
      feedProducts: [{ id: 'a' }, { id: 'b', ownerFarm: 'SNR Farm' }, { id: 'c', ownerFarm: 'Other Farm' }],
    } as unknown as ERPLivestockData;
    expect(scopeDataToFarm(data, 'SNR Farm').feedProducts?.map(p => p.id)).toEqual(['a', 'b']);
  });
});
