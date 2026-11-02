import { stockRepository } from '../repositories/stock.repository';
import { weightRepository } from '../repositories/weight.repository';
import type { PoolClient } from 'pg';
import { withTransaction } from '../config/database';
import { StockItem, WeightRecord } from '../lib/xlsx-parser';
import type { FarmScope } from '../lib/farm-scope';
import { farmLimitService } from './farm-limit.service';
import { registrationRepository } from '../repositories/registration.repository';
import { Actor, AuthzError } from '../lib/authz';
import { canSetLimits } from '../lib/farm-limit';
import { photoProblem } from '../lib/cattle-photo';

const checkPhoto = (url?: string | null): void => {
  const problem = photoProblem(url);
  if (problem) throw new Error(problem);
};

export class StockService {
  async getAllStock(scope?: FarmScope): Promise<StockItem[]> {
    return stockRepository.findAll(scope);
  }

  /** The picture of one animal, read when its page opens (lists do not carry it). */
  async getPhoto(id: string): Promise<string | null> {
    return stockRepository.findPhoto(id);
  }

  async getStockById(id: string): Promise<StockItem | null> {
    return stockRepository.findById(id);
  }

  /**
   * Add a new stock item AND insert initial weight tracking record in a single SQL Transaction
   */
  async createStock(item: Omit<StockItem, 'no'>, registeredBy = ''): Promise<StockItem> {
    checkPhoto(item.imageUrl);
    const created = await this.createStockRecord(item, registeredBy);
    return created;
  }

  /**
   * Registers a whole list at once (a supplier's receipt). All or nothing: one
   * transaction, the farm's cattle limit checked once for the whole list, and
   * a tag already in use stops everything. Each animal is billed like any other.
   */
  /**
   * Registers a list in one transaction (all or none). `hooks` run inside that transaction: `before` can refuse the list
   * (the receipt duplicate check), `after` saves what belongs with it (the receipt record).
   */
  async createMany(
    items: Omit<StockItem, 'no'>[],
    registeredBy = '',
    hooks: { before?: (client: PoolClient) => Promise<void>; after?: (client: PoolClient, created: StockItem[]) => Promise<void> } = {},
  ): Promise<StockItem[]> {
    if (items.length === 0) return [];
    items.forEach(i => checkPhoto(i.imageUrl));
    return withTransaction(async (client) => {
      if (hooks.before) await hooks.before(client);
      const perFarm = new Map<string, number>();
      for (const item of items) perFarm.set(item.location, (perFarm.get(item.location) ?? 0) + 1);
      for (const [farm, n] of perFarm) await farmLimitService.assertRoom(farm, n, client);
      const created: StockItem[] = [];
      for (const item of items) {
        if (await stockRepository.findById(item.id)) throw new Error(`The tag ${item.id} is already used by another animal.`);
        created.push(await this.insertStock(item, registeredBy, client));
      }
      if (hooks.after) await hooks.after(client, created);
      return created;
    });
  }

  private async createStockRecord(item: Omit<StockItem, 'no'>, registeredBy: string): Promise<StockItem> {
    return withTransaction(async (client) => {
      // Every animal registered on a farm counts toward its cattle limit.
      await farmLimitService.assertRoom(item.location, 1, client);
      return this.insertStock(item, registeredBy, client);
    });
  }

  /** The animal, its registration record (the bill) and its first weight, inside the caller's transaction. */
  private async insertStock(item: Omit<StockItem, 'no'>, registeredBy: string, client: PoolClient): Promise<StockItem> {
    const newStock = await stockRepository.create(item, client);
    // The permanent record the monthly bill is built from (src/lib/billing.ts).
    await registrationRepository.record(newStock.id, newStock.location, registeredBy, client);

    const initialWeightRecord: WeightRecord = {
      cowId: newStock.id,
      breed: newStock.breed,
      age: newStock.age,
      oldWeight: 0,
      currentWeight: newStock.weight,
      gainLoss: 0,
      healthStatus: newStock.healthStatus,
      status: newStock.status,
      trackingDate: newStock.purchaseDate || new Date().toISOString()
    };

    await weightRepository.create(initialWeightRecord, client);
    return newStock;
  }

  /**
   * Update stock item. If weight or health status changes, insert a new weight tracking history entry in a single SQL Transaction.
   */
  async updateStock(id: string, updates: Partial<StockItem>): Promise<StockItem> {
    checkPhoto(updates.imageUrl);
    return withTransaction(async (client) => {
      const original = await stockRepository.findById(id);
      if (!original) {
        throw new Error(`Cow with ID ${id} not found`);
      }
      // Moving an animal onto another farm takes a place in that farm's cattle limit.
      if (updates.location && (updates.location ?? '').trim().toLowerCase() !== (original.location ?? '').trim().toLowerCase()) {
        await farmLimitService.assertRoom(updates.location, 1, client);
      }

      const updatedStock = await stockRepository.update(id, updates, client);

      if (updates.weight !== undefined || updates.healthStatus !== undefined) {
        const newWeight = updates.weight ?? original.weight;
        const newHealth = updates.healthStatus ?? original.healthStatus;

        const weightRecord: WeightRecord = {
          cowId: id,
          breed: updatedStock.breed,
          age: updatedStock.age,
          oldWeight: original.weight,
          currentWeight: newWeight,
          gainLoss: original.weight > 0 ? (newWeight - original.weight) / original.weight : 0,
          healthStatus: newHealth,
          status: updatedStock.status,
          trackingDate: new Date().toISOString()
        };

        await weightRepository.create(weightRecord, client);
      }

      return updatedStock;
    });
  }

  /**
   * Removes a cattle record. Registrations are billed, so only a Super Admin or
   * Admin may do it, and only for an animal registered by mistake: the
   * registration record stays (marked removed and not billed) and the removal
   * is logged with who did it.
   */
  async deleteStock(id: string, actor: Actor): Promise<boolean> {
    if (!canSetLimits(actor)) throw new AuthzError('Only a Super Admin or Admin can remove a registered animal, and only if it was registered by mistake.', 403);
    return withTransaction(async (client) => {
      const deleted = await stockRepository.delete(id, client);
      if (deleted) await registrationRepository.markRemoved(id, actor.name, 'Removed by an admin (registered by mistake)', client);
      return deleted;
    });
  }
}

export const stockService = new StockService();
