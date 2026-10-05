import { stockRepository } from '../repositories/stock.repository';
import { weightRepository } from '../repositories/weight.repository';
import { withTransaction } from '../config/database';
import { StockItem, WeightRecord } from '../lib/xlsx-parser';
import type { FarmScope } from '../lib/farm-scope';

export class StockService {
  async getAllStock(scope?: FarmScope): Promise<StockItem[]> {
    return stockRepository.findAll(scope);
  }

  async getStockById(id: string): Promise<StockItem | null> {
    return stockRepository.findById(id);
  }

  /**
   * Add a new stock item AND insert initial weight tracking record in a single SQL Transaction
   */
  async createStock(item: Omit<StockItem, 'no'>): Promise<StockItem> {
    return withTransaction(async (client) => {
      const newStock = await stockRepository.create(item, client);

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
    });
  }

  /**
   * Update stock item. If weight or health status changes, insert a new weight tracking history entry in a single SQL Transaction.
   */
  async updateStock(id: string, updates: Partial<StockItem>): Promise<StockItem> {
    return withTransaction(async (client) => {
      const original = await stockRepository.findById(id);
      if (!original) {
        throw new Error(`Cow with ID ${id} not found`);
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

  async deleteStock(id: string): Promise<boolean> {
    return withTransaction(async (client) => {
      return stockRepository.delete(id, client);
    });
  }

  async updateStockLocation(oldLocation: string, newLocation: string): Promise<void> {
    return withTransaction(async (client) => {
      await stockRepository.updateLocation(oldLocation, newLocation, client);
    });
  }
}

export const stockService = new StockService();
