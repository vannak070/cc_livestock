import { salesRepository } from '../repositories/sales.repository';
import { stockRepository } from '../repositories/stock.repository';
import { batchRepository } from '../repositories/batch.repository';
import { withTransaction } from '../config/database';
import { SalesRecord } from '../lib/xlsx-parser';
import type { FarmScope } from '../lib/farm-scope';

export class SalesService {
  async getAllSales(scope?: FarmScope): Promise<SalesRecord[]> {
    return salesRepository.findAll(scope);
  }

  async getSaleByCowId(cowId: string): Promise<SalesRecord | null> {
    return salesRepository.findByCowId(cowId);
  }

  /**
   * Record sale of a cow: update cow status to 'Sold' and insert sales tracking record inside a single SQL transaction
   */
  async recordSale(cowId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string, buyer?: string): Promise<SalesRecord> {
    return withTransaction(async (client) => {
      const cow = await stockRepository.findById(cowId);
      if (!cow) {
        throw new Error(`Cow with ID ${cowId} not found`);
      }

      await stockRepository.update(cowId, { status: 'Sold' }, client);

      const totalPrice = saleType === 'Weight' ? cow.weight * unitPrice : unitPrice;

      const saleRecord: SalesRecord = {
        cowId,
        breed: cow.breed,
        age: cow.age,
        weight: cow.weight,
        unitPrice,
        totalPrice,
        status: 'Sold',
        salesDate: salesDate || new Date().toISOString(),
        saleType: saleType === 'Weight' ? 'Scale' : 'Lumpsum',
        buyer: buyer || 'Local Market'
      };

      return salesRepository.create(saleRecord, client);
    });
  }

  /**
   * Record batch sale: sell all active cows in batch, update batch status to Closed inside a single SQL transaction
   */
  async recordBatchSale(batchId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string): Promise<SalesRecord[]> {
    return withTransaction(async (client) => {
      const batch = await batchRepository.findById(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const allStock = await stockRepository.findAll();
      const activeCows = allStock.filter(c => batch.cowIds.includes(c.id) && c.status.toLowerCase() === 'active');

      const records: SalesRecord[] = [];

      for (const cow of activeCows) {
        await stockRepository.update(cow.id, { status: 'Sold' }, client);
        const totalPrice = saleType === 'Weight' ? cow.weight * unitPrice : unitPrice;

        const saleRecord: SalesRecord = {
          cowId: cow.id,
          breed: cow.breed,
          age: cow.age,
          weight: cow.weight,
          unitPrice,
          totalPrice,
          status: 'Sold',
          salesDate: salesDate || new Date().toISOString()
        };

        const created = await salesRepository.create(saleRecord, client);
        records.push(created);
      }

      await batchRepository.update(batchId, { status: 'Closed' }, client);
      return records;
    });
  }

  async updateSalesRecord(cowId: string, updates: Partial<SalesRecord>): Promise<SalesRecord> {
    return salesRepository.update(cowId, updates);
  }

  async deleteSalesRecord(cowId: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const deleted = await salesRepository.delete(cowId, client);
      if (deleted) {
        // Revert cow status back to Active
        await stockRepository.update(cowId, { status: 'Active' }, client);
      }
      return deleted;
    });
  }
}

export const salesService = new SalesService();
