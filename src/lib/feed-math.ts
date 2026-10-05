import type { BatchItem, FeedProductItem } from './types';

/**
 * Pure feed helpers shared by the daily ration job (server) and the screens
 * (browser). Nothing here touches the database.
 */

/** Ids of cattle still on the farm (status Active). */
export function activeCattleIds(stock: { id: string; status: string }[]): Set<string> {
  return new Set(stock.filter(c => c.status.toLowerCase() === 'active').map(c => c.id));
}

/**
 * How many head a batch is actually feeding: only its cattle that are still
 * active. Sold or dead cattle can stay listed on a batch for its history, and
 * must not be fed (or counted) any more.
 */
export function activeHeadcount(batch: Pick<BatchItem, 'cowIds'>, activeIds: Set<string>): number {
  return (batch.cowIds || []).filter(id => activeIds.has(id)).length;
}

/**
 * The feed product a ration ingredient draws from: a name match either way
 * round, or the product id. Falls back to the first product, as the ration
 * job always has (an open question with the owner: see the roadmap notes).
 */
export function matchIngredientProduct(ingredientName: string, products: FeedProductItem[]): FeedProductItem | undefined {
  const ing = ingredientName.toLowerCase();
  return products.find(p =>
    p.name.toLowerCase().includes(ing) ||
    ing.includes(p.name.toLowerCase()) ||
    p.id.toLowerCase() === ing
  ) || products[0];
}
