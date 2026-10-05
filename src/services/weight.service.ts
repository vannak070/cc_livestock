import { weightRepository } from '../repositories/weight.repository';
import { stockRepository } from '../repositories/stock.repository';
import { withTransaction } from '../config/database';
import { WeightRecord } from '../lib/xlsx-parser';
import type { FarmScope } from '../lib/farm-scope';

export class WeightService {
  async getAllWeightRecords(scope?: FarmScope): Promise<WeightRecord[]> {
    return weightRepository.findAll(scope);
  }

  async getWeightRecordsByCowId(cowId: string): Promise<WeightRecord[]> {
    return weightRepository.findByCowId(cowId);
  }

  /**
   * Add a new weight record and update the current weight & health status of the cow in stock inside a single SQL transaction
   */
  async addWeightRecord(cowId: string, currentWeight: number, healthStatus: string, trackingDate?: string): Promise<WeightRecord> {
    return withTransaction(async (client) => {
      const cow = await stockRepository.findById(cowId);
      if (!cow) {
        throw new Error(`Cow with ID ${cowId} not found`);
      }

      const oldWeight = cow.weight;
      await stockRepository.update(cowId, { weight: currentWeight, healthStatus }, client);

      const record: WeightRecord = {
        cowId,
        breed: cow.breed,
        age: cow.age,
        oldWeight,
        currentWeight,
        gainLoss: oldWeight > 0 ? (currentWeight - oldWeight) / oldWeight : 0,
        healthStatus,
        status: cow.status,
        trackingDate: trackingDate || new Date().toISOString()
      };

      return weightRepository.create(record, client);
    });
  }

  /**
   * Weigh several animals in one transaction: either every weight is saved or
   * none is. All animals are checked before anything is written.
   */
  async addWeightRecords(records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]): Promise<WeightRecord[]> {
    if (records.length === 0) return [];
    return withTransaction(async (client) => {
      const cows = new Map((await stockRepository.findByIds([...new Set(records.map(r => r.cowId))], client)).map(c => [c.id, c]));
      const missing = [...new Set(records.map(r => r.cowId))].filter(id => !cows.has(id));
      if (missing.length) throw new Error(`Cow with ID ${missing.join(', ')} not found`);

      const saved: WeightRecord[] = [];
      const latest = new Map<string, number>(); // an animal listed twice: the second record follows the first
      for (const rec of records) {
        const cow = cows.get(rec.cowId)!;
        const oldWeight = latest.get(rec.cowId) ?? cow.weight;
        await stockRepository.update(rec.cowId, { weight: rec.currentWeight, healthStatus: rec.healthStatus }, client);
        latest.set(rec.cowId, rec.currentWeight);
        saved.push(await weightRepository.create({
          cowId: rec.cowId,
          breed: cow.breed,
          age: cow.age,
          oldWeight,
          currentWeight: rec.currentWeight,
          gainLoss: oldWeight > 0 ? (rec.currentWeight - oldWeight) / oldWeight : 0,
          healthStatus: rec.healthStatus,
          status: cow.status,
          trackingDate: rec.trackingDate || new Date().toISOString()
        }, client));
      }
      return saved;
    });
  }

  /**
   * Update weight record and update cow stock if it's the latest tracking entry
   */
  async updateWeightRecord(cowId: string, trackingDate: string, currentWeight: number, healthStatus: string): Promise<WeightRecord | null> {
    return withTransaction(async (client) => {
      const updated = await weightRepository.update(cowId, trackingDate, currentWeight, healthStatus, client);
      
      const history = await weightRepository.findByCowId(cowId);
      if (history.length > 0 && history[0].trackingDate === trackingDate) {
        await stockRepository.update(cowId, { weight: currentWeight, healthStatus }, client);
      }

      return updated;
    });
  }

  /**
   * Delete weight record and update cow weight to latest remaining history entry
   */
  async deleteWeightRecord(cowId: string, trackingDate: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const deleted = await weightRepository.delete(cowId, trackingDate, client);
      if (deleted) {
        const remaining = await weightRepository.findByCowId(cowId);
        if (remaining.length > 0) {
          await stockRepository.update(cowId, {
            weight: remaining[0].currentWeight,
            healthStatus: remaining[0].healthStatus
          }, client);
        }
      }
      return deleted;
    });
  }
}

export const weightService = new WeightService();
