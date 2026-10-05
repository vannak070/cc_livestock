import { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.middleware';
import { proposalPlanService } from '../services/proposal-plan.service';

export class ProposalPlanController {
  async list(req: Request, res: Response): Promise<void> {
    const plans = await proposalPlanService.getPlans();
    res.status(200).json({ success: true, message: 'Proposal plans retrieved successfully', data: plans });
  }

  async save(req: Request, res: Response): Promise<void> {
    const saved = await proposalPlanService.savePlan(Number(req.params.slot), req.body?.name, req.body?.params, (req as AuthedRequest).actor?.name);
    res.status(200).json({ success: true, message: 'Proposal plan saved successfully', data: saved });
  }

  async remove(req: Request, res: Response): Promise<void> {
    const deleted = await proposalPlanService.deletePlan(Number(req.params.slot));
    res.status(deleted ? 200 : 404).json({ success: deleted, message: deleted ? 'Proposal plan deleted successfully' : 'Plan not found' });
  }
}

export const proposalPlanController = new ProposalPlanController();
