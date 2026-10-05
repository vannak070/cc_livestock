import { Request, Response } from 'express';
import { farmGuard } from '../lib/farm-guard';
import type { AuthedRequest } from '../middleware/auth.middleware';
import { scopeFor } from '../lib/farm-scope';
import { healthService } from '../services/health.service';

export class HealthController {
  async getAll(req: Request, res: Response): Promise<void> {
    const logs = await healthService.getAllHealthLogs(scopeFor((req as AuthedRequest).actor ?? {}));
    res.status(200).json({
      success: true,
      message: 'Health logs retrieved successfully',
      data: logs
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    await farmGuard.cows((req as AuthedRequest).actor!, [req.body?.cowId]);
    const log = await healthService.addHealthLog(req.body);
    res.status(201).json({
      success: true,
      message: 'Health log added successfully',
      data: log
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.healthLog((req as AuthedRequest).actor!, id);
    await farmGuard.cows((req as AuthedRequest).actor!, [req.body?.cowId]);
    const updated = await healthService.updateHealthLog(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Health log updated successfully',
      data: updated
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.healthLog((req as AuthedRequest).actor!, id);
    await healthService.deleteHealthLog(id);
    res.status(200).json({
      success: true,
      message: 'Health log deleted successfully',
      data: null
    });
  }
}

export const healthController = new HealthController();
