import { Router } from 'express';
import { proposalPlanController } from '../controllers/proposal-plan.controller';
import { requirePlanningAccess } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePlanningAccess, (req, res, next) => proposalPlanController.list(req, res).catch(next));
router.put('/:slot', requirePlanningAccess, (req, res, next) => proposalPlanController.save(req, res).catch(next));
router.delete('/:slot', requirePlanningAccess, (req, res, next) => proposalPlanController.remove(req, res).catch(next));

export default router;
