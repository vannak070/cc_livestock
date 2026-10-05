import { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.middleware';
import { scopeFor } from '../lib/farm-scope';
import { batchService } from '../services/batch.service';

export class BatchController {
  async getAll(req: Request, res: Response): Promise<void> {
    const batches = await batchService.getAllBatches(scopeFor((req as AuthedRequest).actor ?? {}));
    res.status(200).json({
      success: true,
      message: 'Batches retrieved successfully',
      data: batches
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const batch = await batchService.getBatchById(id);
    if (!batch) {
      res.status(404).json({
        success: false,
        message: `Batch ${id} not found`,
        data: null
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Batch retrieved successfully',
      data: batch
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    const newBatch = await batchService.createBatch(req.body);
    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: newBatch
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const updated = await batchService.updateBatch(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Batch updated successfully',
      data: updated
    });
  }

  async assignCows(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { cowIds } = req.body;
    const updated = await batchService.assignCowsToBatch(id, cowIds || []);
    res.status(200).json({
      success: true,
      message: 'Cows assigned to batch successfully',
      data: updated
    });
  }

  async removeCow(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const cowId = String(req.params.cowId);
    const updated = await batchService.removeCowFromBatch(id, cowId);
    res.status(200).json({
      success: true,
      message: 'Cow removed from batch successfully',
      data: updated
    });
  }

  async recordBatchWeights(req: Request, res: Response): Promise<void> {
    const { records } = req.body;
    await batchService.recordBatchWeights(records || []);
    res.status(200).json({
      success: true,
      message: 'Batch weights recorded successfully',
      data: null
    });
  }

  async recordBatchHealthLog(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const logs = await batchService.recordBatchHealthLog(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Batch health logs recorded successfully',
      data: logs
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await batchService.deleteBatch(id);
    res.status(200).json({
      success: true,
      message: 'Batch deleted successfully',
      data: null
    });
  }
}

export const batchController = new BatchController();
