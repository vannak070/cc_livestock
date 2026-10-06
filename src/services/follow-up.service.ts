import { randomUUID } from 'crypto';
import { withTransaction } from '../config/database';
import { followUpRepository } from '../repositories/follow-up.repository';
import { stockRepository } from '../repositories/stock.repository';
import { Actor, assertPermission } from '../lib/authz';
import { farmGuard } from '../lib/farm-guard';
import { farmToday } from '../lib/daily-feed';
import { followUpProblem, type FollowUpInput } from '../lib/long-stay';
import type { CattleFollowUp } from '../lib/types';

/**
 * Next actions for long-stay cattle. Recording one is a management decision,
 * like the batch sale review, so it uses the same `batch_review` permission
 * (Management, Company, Farm Owner, admins). It changes no cattle records.
 */
export class FollowUpService {
  /** Records the animal's next action; an earlier open one is closed (it stays in the history). */
  async record(actor: Actor, cowId: string, input: FollowUpInput): Promise<CattleFollowUp> {
    assertPermission(actor, 'batch_review');
    await farmGuard.cows(actor, [cowId]);
    const cow = await stockRepository.findById(cowId);
    if (!cow) throw new Error(`Cow with ID ${cowId} not found.`);
    if (cow.status.toLowerCase() !== 'active') throw new Error(`${cowId} is no longer on the farm.`);
    const problem = followUpProblem(input, farmToday());
    if (problem) throw new Error(problem);
    const followUp = {
      id: `FUP-${randomUUID().slice(0, 8).toUpperCase()}`,
      cowId: cow.id,
      action: input.action,
      note: (input.note ?? '').trim(),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      createdBy: actor.name,
    };
    await withTransaction(async client => {
      await followUpRepository.closeOpenFor(cow.id, actor.name, client);
      await followUpRepository.create(followUp, client);
    });
    return { ...followUp, createdAt: new Date().toISOString() };
  }

  /** Marks a next action done. */
  async finish(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, 'batch_review');
    const f = await followUpRepository.findById(id);
    if (!f) throw new Error('That next action no longer exists.');
    await farmGuard.cows(actor, [f.cowId]);
    if (!(await followUpRepository.markDone(id, actor.name))) throw new Error('That next action was already marked done. Reload the page.');
  }
}

export const followUpService = new FollowUpService();
