import { Actor } from '../lib/authz';
import { farmToday } from '../lib/daily-feed';
import { saleReviewProblem, type SaleReviewInput } from '../lib/sale-review';
import { batchRepository } from '../repositories/batch.repository';
import type { BatchItem, SaleReview } from '../types/batch.types';

/** Management's decision on a batch near its selling date: sell it, or keep feeding with a new date. */
export class SaleReviewService {
  async review(actor: Actor, batchId: string, input: SaleReviewInput): Promise<BatchItem> {
    const batch = await batchRepository.findById(batchId);
    if (!batch) throw new Error('That batch no longer exists.');
    if (batch.status !== 'Active') throw new Error('Only a batch that is still active can be reviewed.');

    const problem = saleReviewProblem(input, farmToday());
    if (problem) throw new Error(problem);

    const review: SaleReview = {
      decision: input.decision,
      by: actor.name,
      at: new Date().toISOString(),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.decision === 'extend' && batch.sellingTargetDate ? { previousTarget: batch.sellingTargetDate.slice(0, 10) } : {}),
    };
    try {
      return await batchRepository.update(batchId, {
        saleReview: review,
        ...(input.decision === 'extend' ? { sellingTargetDate: input.newTargetDate } : {}),
      });
    } catch (err) {
      if (err instanceof Error && /sale_review/.test(err.message)) throw new Error('The review could not be saved: run "npm run safe-migrate" first.');
      throw err;
    }
  }
}

export const saleReviewService = new SaleReviewService();
