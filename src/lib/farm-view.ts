import { productsForFarm } from './feed-products';
import type { ERPLivestockData } from './types';
import { farmMatcher } from './farm-scope';

// Kept apart from data-scope.ts on purpose: this file is used in the browser, and data-scope.ts reaches the database.

/**
 * The records of one farm. Used on the server for people tied to a farm, and in
 * the browser for the "Working on" choice, where an office account looks at one
 * farm at a time. The settings (every farm, the account roster) are left as they are.
 * `includeFeed` also narrows the feed movements to the ones that touch this farm.
 */
export function scopeDataToFarm(data: ERPLivestockData, farmLoc: string, options: { includeFeed?: boolean } = {}): ERPLivestockData {
  const matchesFarm = farmMatcher(farmLoc);

  const stock = data.stock.filter(item => matchesFarm(item.location));
  const stockIds = new Set(stock.map(c => c.id));

  const batches = data.batches
    .map(batch => ({ ...batch, cowIds: batch.cowIds.filter(id => stockIds.has(id)) }))
    .filter(batch => matchesFarm(batch.farmLocation) || !batch.farmLocation || batch.cowIds.length > 0);

  const feedTransactions = options.includeFeed
    ? (data.feedTransactions ?? []).filter(t => (isPlace(t.targetFarm) && t.targetFarm === farmLoc) || (isPlace(t.sourceFarm) && t.sourceFarm === farmLoc))
    : data.feedTransactions;

  return {
    ...data,
    stock,
    batches,
    weightTracking: data.weightTracking.filter(item => stockIds.has(item.cowId)),
    healthLogs: data.healthLogs.filter(item => stockIds.has(item.cowId)),
    salesTracking: data.salesTracking.filter(item => stockIds.has(item.cowId)),
    farmCosts: (data.farmCosts ?? []).filter(item => matchesFarm(item.farmLocation)),
    // Default products, plus the ones this farm made; other farms' own products stay out of view.
    feedProducts: productsForFarm(data.feedProducts ?? [], farmLoc),
    ...(options.includeFeed ? { feedTransactions } : {}),
    common: { ...data.common, locations: [farmLoc] }
  };
}

/** A real place on the farm side of a feed movement, not the supplier or the daily ration. */
function isPlace(name?: string): boolean {
  return !!name && !name.startsWith('Daily Feed') && name !== 'Supplier' && name !== 'Central Warehouse';
}
