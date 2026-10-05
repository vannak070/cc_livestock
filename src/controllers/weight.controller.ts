import { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.middleware';
import { scopeFor } from '../lib/farm-scope';
import { weightService } from '../services/weight.service';

export class WeightController {
  async getAll(req: Request, res: Response): Promise<void> {
    const records = await weightService.getAllWeightRecords(scopeFor((req as AuthedRequest).actor ?? {}));
    res.status(200).json({
      success: true,
      message: 'Weight tracking records retrieved successfully',
      data: records
    });
  }

  async getByCowId(req: Request, res: Response): Promise<void> {
    const cowId = String(req.params.cowId);
    const records = await weightService.getWeightRecordsByCowId(cowId);
    res.status(200).json({
      success: true,
      message: `Weight records for cow ${cowId} retrieved successfully`,
      data: records
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    const { cowId, currentWeight, healthStatus, trackingDate } = req.body;
    if (!cowId || currentWeight === undefined || !healthStatus) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: cowId, currentWeight, healthStatus',
        data: null
      });
      return;
    }

    const record = await weightService.addWeightRecord(cowId, Number(currentWeight), healthStatus, trackingDate);
    res.status(201).json({
      success: true,
      message: 'Weight record added successfully',
      data: record
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const cowId = String(req.params.cowId);
    const { trackingDate, currentWeight, healthStatus } = req.body;

    const updated = await weightService.updateWeightRecord(cowId, trackingDate, Number(currentWeight), healthStatus);
    res.status(200).json({
      success: true,
      message: 'Weight record updated successfully',
      data: updated
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const cowId = String(req.params.cowId);
    const trackingDate = String(req.query.trackingDate || '');

    await weightService.deleteWeightRecord(cowId, trackingDate);
    res.status(200).json({
      success: true,
      message: 'Weight record deleted successfully',
      data: null
    });
  }
}

export const weightController = new WeightController();
