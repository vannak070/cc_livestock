import { Router } from 'express';
import { salesController } from '../controllers/sales.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePermission('sales_view'), (req, res, next) => salesController.getAll(req, res).catch(next));
router.post('/', requirePermission('sales_record'), (req, res, next) => salesController.create(req, res).catch(next));
router.post('/batch', requirePermission('sales_record'), (req, res, next) => salesController.recordBatchSale(req, res).catch(next));
router.put('/:cowId', requirePermission('sales_record'), (req, res, next) => salesController.update(req, res).catch(next));
router.delete('/:cowId', requirePermission('sales_delete'), (req, res, next) => salesController.delete(req, res).catch(next));

export default router;
