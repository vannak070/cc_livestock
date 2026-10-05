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
 * The feed product a ration ingredient draws from: the product it is linked
 * to, else the product with the same name or id, else the only product whose
 * name contains the ingredient's (or the other way round). Nothing when there
 * is no clear match: the screens then ask which feed it is, and no stock is
 * taken from a guessed feed. Used by the daily job, the Feed page, Today and
 * the batch screens, so they always agree.
 */
export function matchIngredientProduct(
  ingredient: { name: string; productId?: string },
  products: FeedProductItem[]
): FeedProductItem | undefined {
  if (ingredient.productId) {
    const linked = products.find(p => p.id === ingredient.productId);
    if (linked) return linked;
  }
  const n = ingredient.name.toLowerCase().trim();
  if (!n) return undefined;
  const exact = products.find(p => p.name.toLowerCase().trim() === n || p.id.toLowerCase() === n);
  if (exact) return exact;
  const partial = products.filter(p => {
    const name = p.name.toLowerCase().trim();
    return !!name && (name.includes(n) || n.includes(name));
  });
  return partial.length === 1 ? partial[0] : undefined;
}
