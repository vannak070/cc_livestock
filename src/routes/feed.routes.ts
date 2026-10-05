import { Router } from 'express';
import { feedController } from '../controllers/feed.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

router.get('/products', requirePermission('feed_view'), (req, res, next) => feedController.getProducts(req, res).catch(next));
router.get('/transactions', requirePermission('feed_view'), (req, res, next) => feedController.getTransactions(req, res).catch(next));

export default router;
