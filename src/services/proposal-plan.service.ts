import { proposalPlanRepository } from '../repositories/proposal-plan.repository';
import { opsProgramRepository } from '../repositories/ops-program.repository';
import { MAX_PLANS, ProposalPlanRecord } from '../types/proposal.types';
import { parsePlanParams, planName } from '../lib/proposal-plan';

export class ProposalPlanService {
  async getPlans(): Promise<ProposalPlanRecord[]> {
    return proposalPlanRepository.findAll();
  }

  /** Saves a plan into a slot (1 to 10), replacing what was there. Throws on anything invalid. */
  async savePlan(slot: unknown, name: unknown, params: unknown, updatedBy?: string): Promise<ProposalPlanRecord> {
    if (!Number.isInteger(slot) || (slot as number) < 1 || (slot as number) > MAX_PLANS) {
      throw new Error(`A plan slot is a whole number from 1 to ${MAX_PLANS}.`);
    }
    const valid = parsePlanParams(params);
    if (!valid) throw new Error('The plan numbers are incomplete or not valid.');
    return proposalPlanRepository.save(slot as number, planName(name, slot as number), valid, updatedBy);
  }

  /** Farms whose open (not closed) farm program is made from this plan. */
  async farmsUsing(slot: number): Promise<string[]> {
    // The program tables only exist once migration 027 has run; before that nothing uses a plan.
    const programs = await opsProgramRepository.programs().catch(() => []);
    return programs.filter(p => p.planSlot === slot && p.status !== 'Closed').map(p => p.farm).sort((a, b) => a.localeCompare(b));
  }

  /** Deletes a plan. A plan that a farm's action plan (farm program) is made from cannot be deleted. */
  async deletePlan(slot: unknown): Promise<boolean> {
    if (!Number.isInteger(slot) || (slot as number) < 1 || (slot as number) > MAX_PLANS) {
      throw new Error(`A plan slot is a whole number from 1 to ${MAX_PLANS}.`);
    }
    const farms = await this.farmsUsing(slot as number);
    if (farms.length > 0) {
      throw new Error(`Plan ${slot} is used by the action plan of ${farms.join(', ')}, so it cannot be deleted. Close those farm plans first, or keep this plan.`);
    }
    return proposalPlanRepository.delete(slot as number);
  }
}

export const proposalPlanService = new ProposalPlanService();
