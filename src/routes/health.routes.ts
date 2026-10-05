import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePermission('health_view'), (req, res, next) => healthController.getAll(req, res).catch(next));
router.post('/', requirePermission('health_record'), (req, res, next) => healthController.create(req, res).catch(next));
router.put('/:id', requirePermission('health_record'), (req, res, next) => healthController.update(req, res).catch(next));
router.delete('/:id', requirePermission('health_delete'), (req, res, next) => healthController.delete(req, res).catch(next));

export default router;
