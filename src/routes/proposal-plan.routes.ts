import { Router } from 'express';
import { proposalPlanController } from '../controllers/proposal-plan.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePermission('analytics_view'), (req, res, next) => proposalPlanController.list(req, res).catch(next));
router.put('/:slot', requirePermission('analytics_view'), (req, res, next) => proposalPlanController.save(req, res).catch(next));
router.delete('/:slot', requirePermission('analytics_view'), (req, res, next) => proposalPlanController.remove(req, res).catch(next));

export default router;
