import { proposalPlanRepository } from '../repositories/proposal-plan.repository';
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

  async deletePlan(slot: unknown): Promise<boolean> {
    if (!Number.isInteger(slot) || (slot as number) < 1 || (slot as number) > MAX_PLANS) {
      throw new Error(`A plan slot is a whole number from 1 to ${MAX_PLANS}.`);
    }
    return proposalPlanRepository.delete(slot as number);
  }
}

export const proposalPlanService = new ProposalPlanService();
