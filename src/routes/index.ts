import { Router } from 'express';
import stockRoutes from './stock.routes';
import weightRoutes from './weight.routes';
import salesRoutes from './sales.routes';
import batchRoutes from './batch.routes';
import healthRoutes from './health.routes';
import settingsRoutes from './settings.routes';
import authRoutes from './auth.routes';
import feedRoutes from './feed.routes';
import proposalPlanRoutes from './proposal-plan.routes';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Sign-in endpoints are the only ones reachable without a session token.
// /auth/me applies requireAuth itself.
router.use('/auth', authRoutes);

// Everything below requires a valid session; each route then checks the
// specific permission it needs (see the individual *.routes.ts files).
router.use(requireAuth);

// Mount modular feature routes under API v1 path structure
router.use('/stock', stockRoutes);
router.use('/weight', weightRoutes);
router.use('/sales', salesRoutes);
router.use('/batches', batchRoutes);
router.use('/health', healthRoutes);
router.use('/settings', settingsRoutes);
router.use('/feed', feedRoutes);
router.use('/proposal-plan', proposalPlanRoutes);

export default router;
