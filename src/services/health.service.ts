import { healthRepository } from '../repositories/health.repository';
import { stockRepository } from '../repositories/stock.repository';
import { withTransaction } from '../config/database';
import type { PoolClient } from 'pg';
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
   * A Disease record makes the animal Poor and a Treatment record makes it Good, but only when
   * it is the animal's newest one (by date; the newest entry wins a tie). A record about the past,
   * or a correction to an old one, never undoes what a newer record says.
   */
  private async applyStatus(log: HealthLogItem, client: PoolClient): Promise<void> {
    if (log.type !== 'Disease' && log.type !== 'Treatment') return;
    const newerThan = await healthRepository.latestStatusLogDate(log.cowId, log.id, client);
    if (newerThan && new Date(log.date).getTime() < newerThan.getTime()) return;
    const cow = await stockRepository.findById(log.cowId);
    if (cow) await stockRepository.update(log.cowId, { healthStatus: log.type === 'Disease' ? 'Poor' : 'Good' }, client);
  }

  /** Add a health log and, when it is the newest Disease or Treatment, update the animal's health status, in one transaction. */
  async addHealthLog(log: Omit<HealthLogItem, 'id'>): Promise<HealthLogItem> {
    return withTransaction(async (client) => {
      const newLog = await healthRepository.create(log, client);
      await this.applyStatus(newLog, client);
      return newLog;
    });
  }

  async updateHealthLog(id: string, updates: Partial<HealthLogItem>): Promise<HealthLogItem> {
    return withTransaction(async (client) => {
      const updatedLog = await healthRepository.update(id, updates, client);
      await this.applyStatus(updatedLog, client);
      return updatedLog;
    });
  }

  /**
   * Deleting a mistaken Disease or Treatment record takes back what it did to the animal's status: the animal
   * goes back to what its newest remaining Disease or Treatment record says (Disease: Poor, Treatment: Good), or to
   * Good when it has none left and was only Poor because of the deleted record.
   */
  async deleteHealthLog(id: string): Promise<boolean> {
    const existing = await healthRepository.findById(id);
    return withTransaction(async (client) => {
      const deleted = await healthRepository.delete(id, client);
      if (!deleted || !existing || (existing.type !== 'Disease' && existing.type !== 'Treatment')) return deleted;
      const newest = await healthRepository.latestStatusLog(existing.cowId, client);
      const cow = await stockRepository.findById(existing.cowId);
      if (!cow) return deleted;
      const next = newest ? (newest.type === 'Disease' ? 'Poor' : 'Good') : cow.healthStatus === 'Poor' ? 'Good' : cow.healthStatus;
      if (next !== cow.healthStatus) await stockRepository.update(existing.cowId, { healthStatus: next }, client);
      return deleted;
    });
  }
}

export const healthService = new HealthService();
