import { query } from '../config/database';
import { Actor, AuthzError } from './authz';
import { farmMatcher } from './farm-scope';

/**
 * Write-side (and by-id read) farm checks. Reads of whole lists are already
 * narrowed to the user's farm (farm-scope.ts); these checks stop a user tied
 * to one farm from reaching another farm's records by id, e.g. calling
 * deleteStockItemAction with a cow from a different farm.
 *
 * Users not tied to a farm (admins, company, management) pass every check.
 * A record that does not exist passes too: it cannot belong to another farm,
 * and the normal "not found" handling reports it.
 */
const DENIED = 'You can only work with records from your own farm.';

function deny(): never {
  throw new AuthzError(DENIED, 403);
}

function matcherFor(actor: Actor) {
  return actor.farmLocation ? farmMatcher(actor.farmLocation) : null;
}

export const farmGuard = {
  /** Every listed cow must be on the actor's farm. */
  async cows(actor: Actor, cowIds: (string | undefined | null)[]): Promise<void> {
    const matches = matcherFor(actor);
    if (!matches) return;
    const ids = [...new Set(cowIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    const res = await query('SELECT id, location FROM stock WHERE id = ANY($1)', [ids]);
    if (res.rows.some(row => !matches(row.location))) deny();
  },

  /** A farm name being written (a cow's location, a batch's farm) must be the actor's farm. Skipped when not being changed. */
  location(actor: Actor, location: string | undefined | null): void {
    const matches = matcherFor(actor);
    if (!matches || location === undefined) return;
    if (!matches(location)) deny();
  },

  /** For creating a record: the farm is required and must be the actor's. */
  requireLocation(actor: Actor, location: string | undefined | null): void {
    const matches = matcherFor(actor);
    if (matches && !matches(location ?? '')) deny();
  },

  /**
   * A batch belongs to the actor's farm when its farm matches, or when it has
   * no farm and none of its cattle are on another farm.
   */
  async batch(actor: Actor, batchId: string): Promise<void> {
    const matches = matcherFor(actor);
    if (!matches) return;
    const res = await query('SELECT farm_location FROM batches WHERE id = $1', [batchId]);
    if (res.rows.length === 0) return;
    const farm = res.rows[0].farm_location as string | null;
    if (farm && farm.trim() !== '') {
      if (!matches(farm)) deny();
      return;
    }
    const cows = await query(
      'SELECT s.location FROM batch_cows bc JOIN stock s ON s.id = bc.cow_id WHERE bc.batch_id = $1',
      [batchId]
    );
    if (cows.rows.some(row => !matches(row.location))) deny();
  },

  /** A health log belongs to the farm of the cow it is about. */
  async healthLog(actor: Actor, logId: string): Promise<void> {
    if (!matcherFor(actor)) return;
    const res = await query('SELECT cow_id FROM health_logs WHERE id = $1', [logId]);
    if (res.rows.length === 0) return;
    await farmGuard.cows(actor, [res.rows[0].cow_id]);
  },

  /** Actions that change every farm at once (renaming a location) are for users not tied to one farm. */
  notFarmBound(actor: Actor): void {
    if (actor.farmLocation) deny();
  }
};
