import { Router } from 'express';
import { stockController } from '../controllers/stock.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requirePermission('stock_view'), (req, res, next) => stockController.getAll(req, res).catch(next));
router.post('/', requirePermission('stock_create'), (req, res, next) => stockController.create(req, res).catch(next));
router.get('/:id', requirePermission('stock_view'), (req, res, next) => stockController.getById(req, res).catch(next));
router.put('/:id', requirePermission('stock_edit'), (req, res, next) => stockController.update(req, res).catch(next));
router.delete('/:id', requirePermission('stock_delete'), (req, res, next) => stockController.delete(req, res).catch(next));

export default router;
