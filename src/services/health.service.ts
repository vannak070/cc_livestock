import { healthRepository } from '../repositories/health.repository';
import { stockRepository } from '../repositories/stock.repository';
import { withTransaction } from '../config/database';
import { HealthLogItem } from '../lib/types';
import type { FarmScope } from '../lib/farm-scope';

export class HealthService {
  async getAllHealthLogs(scope?: FarmScope): Promise<HealthLogItem[]> {
    return healthRepository.findAll(scope);
  }

  async getHealthLogById(id: string): Promise<HealthLogItem | null> {
    return healthRepository.findById(id);
  }

  /**
   * Add health log. If log is Disease or Treatment, update cow health_status in stock in a single SQL transaction.
   */
  async addHealthLog(log: Omit<HealthLogItem, 'id'>): Promise<HealthLogItem> {
    return withTransaction(async (client) => {
      const newLog = await healthRepository.create(log, client);

      if (log.type === 'Disease' || log.type === 'Treatment') {
        const cow = await stockRepository.findById(log.cowId);
        if (cow) {
          await stockRepository.update(log.cowId, {
            healthStatus: log.type === 'Disease' ? 'Poor' : 'Good'
          }, client);
        }
      }

      return newLog;
    });
  }

  async updateHealthLog(id: string, updates: Partial<HealthLogItem>): Promise<HealthLogItem> {
    return withTransaction(async (client) => {
      const updatedLog = await healthRepository.update(id, updates, client);

      if (updatedLog.type === 'Disease' || updatedLog.type === 'Treatment') {
        const cow = await stockRepository.findById(updatedLog.cowId);
        if (cow) {
          await stockRepository.update(updatedLog.cowId, {
            healthStatus: updatedLog.type === 'Disease' ? 'Poor' : 'Good'
          }, client);
        }
      }

      return updatedLog;
    });
  }

  async deleteHealthLog(id: string): Promise<boolean> {
    return healthRepository.delete(id);
  }
}

export const healthService = new HealthService();
