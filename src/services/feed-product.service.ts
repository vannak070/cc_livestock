import { Actor, AuthzError } from '../lib/authz';
import { canAddProduct, canEditProduct } from '../lib/feed-products';
import { feedRepository } from '../repositories/feed.repository';
import { FeedProductItem, FeedStockTransaction } from '../types/feed.types';

const DENIED_DEFAULT = 'This is a default product set by the office. Only the office can change it.';

/** Who may change which feed product. Office accounts (feed_manage) change anything; a farm owner only products made for their own farm. */
export class FeedProductService {
  async save(actor: Actor, product: FeedProductItem): Promise<FeedProductItem> {
    const existing = (await feedRepository.getProducts()).find(p => p.id === product.id);
    if (existing ? !canEditProduct(actor, existing) : !canAddProduct(actor)) {
      throw new AuthzError(existing && !existing.ownerFarm ? DENIED_DEFAULT : 'You do not have permission to change this product.', 403);
    }
    const isOffice = (actor.permissions ?? []).includes('feed_manage') || actor.role === 'Super Admin' || actor.role === 'Admin';
    // The farm that owns a product is never taken from the browser: an office
    // edit keeps it, a new office product is a default, a farm owner's is theirs.
    const ownerFarm = existing ? existing.ownerFarm : isOffice ? undefined : actor.farmLocation;
    return feedRepository.saveProduct({ ...product, ownerFarm });
  }

  async remove(actor: Actor, productId: string): Promise<void> {
    const existing = (await feedRepository.getProducts()).find(p => p.id === productId);
    if (!existing) return;
    if (!canEditProduct(actor, existing)) {
      throw new AuthzError(!existing.ownerFarm ? DENIED_DEFAULT : 'You do not have permission to delete this product.', 403);
    }
    await feedRepository.deleteProduct(productId);
  }

  /** Office: any movement. Farm owner: only putting their own product into their own farm. */
  async assertCanMove(actor: Actor, tx: FeedStockTransaction): Promise<void> {
    const isOffice = (actor.permissions ?? []).includes('feed_manage') || actor.role === 'Super Admin' || actor.role === 'Admin';
    if (isOffice) return;
    const product = (await feedRepository.getProducts()).find(p => p.id === tx.productId);
    if (!product || !canEditProduct(actor, product) || tx.type !== 'STOCK_IN' || tx.targetFarm !== actor.farmLocation) {
      throw new AuthzError('You can only put your own farm\'s products into your own farm.', 403);
    }
  }
}

export const feedProductService = new FeedProductService();
