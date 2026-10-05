import { randomUUID } from 'crypto';
import { farmCostRepository } from '../repositories/farm-cost.repository';
import { Actor } from '../lib/authz';
import { farmGuard } from '../lib/farm-guard';
import { farmToday } from '../lib/daily-feed';
import { costCategoriesFrom, farmCostProblem, type FarmCostInput } from '../lib/farm-costs';
import { settingsRepository } from '../repositories/settings.repository';
import type { FarmScope } from '../lib/farm-scope';
import type { FarmCostItem } from '../lib/types';

/**
 * Farm running costs. A farm account can only record and delete its own
 * farm's costs; office accounts can do it for any farm.
 */
export class FarmCostService {
  async getAll(scope?: FarmScope): Promise<FarmCostItem[]> {
    return farmCostRepository.findAll(scope);
  }

  async add(actor: Actor, input: FarmCostInput): Promise<FarmCostItem> {
    const settings = await settingsRepository.getSettings();
    const problem = farmCostProblem(input, farmToday(), costCategoriesFrom(settings));
    if (problem) throw new Error(problem);
    farmGuard.requireLocation(actor, input.farmLocation);
    return farmCostRepository.create({
      id: `COST-${randomUUID().slice(0, 8).toUpperCase()}`,
      farmLocation: input.farmLocation.trim(),
      category: input.category,
      amount: Math.round(input.amount),
      date: input.date,
      note: input.note?.trim() || '',
      recordedBy: actor.name
    });
  }

  async remove(actor: Actor, id: string): Promise<boolean> {
    const cost = await farmCostRepository.findById(id);
    if (!cost) throw new Error('That cost was already removed. Reload the page.');
    farmGuard.location(actor, cost.farmLocation);
    return farmCostRepository.delete(id);
  }
}

export const farmCostService = new FarmCostService();
