import { actionPlanRepository } from '../repositories/action-plan.repository';
import { batchRepository } from '../repositories/batch.repository';
import { Actor, AuthzError } from '../lib/authz';
import { isMonth } from '../lib/billing';
import { farmToday } from '../lib/daily-feed';
import { canSeeActionPlans, canWritePlans, contractProblem, type BatchContract, type ContractInput } from '../lib/action-plans';

export interface ActionPlansView {
  /** The month asked for, and this month (the Management report works by month). */
  month: string;
  currentMonth: string;
  contracts: BatchContract[];
}

/**
 * Batch contracts (src/lib/action-plans.ts): the buy-back price per kg a batch can carry as an override of its
 * farm's plan price. Super Admin and Admin write them; Management reads them. The old free-text 3-day plans were
 * retired on 2026-10-15; the work itself is planned by farm programs and tasks (ops-program.service.ts).
 */
export class ActionPlanService {
  private assertSee(actor: Actor) {
    if (!canSeeActionPlans(actor)) throw new AuthzError('Only Super Admin, Admin and Management can see action plans.', 403);
  }
  private assertWrite(actor: Actor) {
    if (!canWritePlans(actor)) throw new AuthzError('Only a Super Admin or Admin can write contracts.', 403);
  }

  async view(actor: Actor, chosen?: string): Promise<ActionPlansView> {
    this.assertSee(actor);
    const currentMonth = farmToday().slice(0, 7);
    // A day (YYYY-MM-DD) is read as its month.
    const month = (chosen ?? currentMonth).slice(0, 7);
    if (!isMonth(month)) throw new Error('Choose a month (year and month).');
    return { month, currentMonth, contracts: await actionPlanRepository.contracts() };
  }

  async saveContract(actor: Actor, batchId: string, input: ContractInput): Promise<BatchContract> {
    this.assertWrite(actor);
    const problem = contractProblem(input);
    if (problem) throw new Error(problem);
    if (!(await batchRepository.findById(batchId))) throw new Error('That batch no longer exists.');
    return actionPlanRepository.saveContract(batchId, input, actor.name);
  }
}

export const actionPlanService = new ActionPlanService();
