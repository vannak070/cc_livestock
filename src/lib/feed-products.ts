import type { FeedProductItem } from '@/types/feed.types';
import type { PermissionKey } from '@/types/settings.types';
import { hasPermission } from './utils';

/** Browser-safe rules for who may change which feed product (the server enforces the same). */
interface Person { role?: string; farmLocation?: string; permissions?: readonly string[] }

const has = (u: Person | undefined, key: PermissionKey) => hasPermission(u, key);

/** A default product, set by the office. */
export const isDefaultProduct = (p: Pick<FeedProductItem, 'ownerFarm'>) => !p.ownerFarm;

/** Whether the person may change this product (an existing one). */
export function canEditProduct(user: Person | undefined, p: Pick<FeedProductItem, 'ownerFarm'>): boolean {
  if (has(user, 'feed_manage')) return true;
  return has(user, 'feed_own_products') && !!user?.farmLocation && p.ownerFarm === user.farmLocation;
}

/** Whether the person may add a new product. */
export function canAddProduct(user: Person | undefined): boolean {
  return has(user, 'feed_manage') || (has(user, 'feed_own_products') && !!user?.farmLocation);
}

/** Default products plus the ones made by `farm`; everything when no farm is given. */
export function productsForFarm<T extends Pick<FeedProductItem, 'ownerFarm'>>(products: T[], farm?: string): T[] {
  return farm ? products.filter(p => !p.ownerFarm || p.ownerFarm === farm) : products;
}
