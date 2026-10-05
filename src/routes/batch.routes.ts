import { Router } from 'express';
import { batchController } from '../controllers/batch.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePermission('batch_view'), (req, res, next) => batchController.getAll(req, res).catch(next));
router.post('/', requirePermission('batch_create'), (req, res, next) => batchController.create(req, res).catch(next));
router.post('/weights', requirePermission('weight_record'), (req, res, next) => batchController.recordBatchWeights(req, res).catch(next));
router.get('/:id', requirePermission('batch_view'), (req, res, next) => batchController.getById(req, res).catch(next));
router.put('/:id', requirePermission('batch_edit'), (req, res, next) => batchController.update(req, res).catch(next));
router.post('/:id/assign', requirePermission('batch_edit'), (req, res, next) => batchController.assignCows(req, res).catch(next));
router.delete('/:id/cows/:cowId', requirePermission('batch_edit'), (req, res, next) => batchController.removeCow(req, res).catch(next));
router.post('/:id/health', requirePermission('health_record'), (req, res, next) => batchController.recordBatchHealthLog(req, res).catch(next));
router.delete('/:id', requirePermission('batch_delete'), (req, res, next) => batchController.delete(req, res).catch(next));

export default router;
