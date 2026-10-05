import { Router } from 'express';
import { weightController } from '../controllers/weight.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePermission('weight_view'), (req, res, next) => weightController.getAll(req, res).catch(next));
router.post('/', requirePermission('weight_record'), (req, res, next) => weightController.create(req, res).catch(next));
router.get('/cow/:cowId', requirePermission('weight_view'), (req, res, next) => weightController.getByCowId(req, res).catch(next));
router.put('/cow/:cowId', requirePermission('weight_record'), (req, res, next) => weightController.update(req, res).catch(next));
router.delete('/cow/:cowId', requirePermission('weight_delete'), (req, res, next) => weightController.delete(req, res).catch(next));

export default router;
