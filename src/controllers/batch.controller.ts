import { Request, Response } from 'express';
import { farmGuard } from '../lib/farm-guard';
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
    await farmGuard.batch((req as AuthedRequest).actor!, id);
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
    farmGuard.requireLocation((req as AuthedRequest).actor!, req.body?.farmLocation);
    const newBatch = await batchService.createBatch(req.body);
    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: newBatch
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.batch((req as AuthedRequest).actor!, id);
    farmGuard.location((req as AuthedRequest).actor!, req.body?.farmLocation);
    if (Array.isArray(req.body?.cowIds)) await farmGuard.cows((req as AuthedRequest).actor!, req.body.cowIds);
    const updated = await batchService.updateBatch(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Batch updated successfully',
      data: updated
    });
  }

  async assignCows(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.batch((req as AuthedRequest).actor!, id);
    const { cowIds } = req.body;
    await farmGuard.cows((req as AuthedRequest).actor!, cowIds || []);
    const updated = await batchService.assignCowsToBatch(id, cowIds || []);
    res.status(200).json({
      success: true,
      message: 'Cows assigned to batch successfully',
      data: updated
    });
  }

  async removeCow(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.batch((req as AuthedRequest).actor!, id);
    const cowId = String(req.params.cowId);
    await farmGuard.cows((req as AuthedRequest).actor!, [cowId]);
    const updated = await batchService.removeCowFromBatch(id, cowId);
    res.status(200).json({
      success: true,
      message: 'Cow removed from batch successfully',
      data: updated
    });
  }

  async recordBatchWeights(req: Request, res: Response): Promise<void> {
    const { records } = req.body;
    await farmGuard.cows((req as AuthedRequest).actor!, Array.isArray(records) ? records.map((r: { cowId?: string }) => r.cowId) : []);
    await batchService.recordBatchWeights(records || []);
    res.status(200).json({
      success: true,
      message: 'Batch weights recorded successfully',
      data: null
    });
  }

  async recordBatchHealthLog(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.batch((req as AuthedRequest).actor!, id);
    const logs = await batchService.recordBatchHealthLog(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Batch health logs recorded successfully',
      data: logs
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.batch((req as AuthedRequest).actor!, id);
    await batchService.deleteBatch(id);
    res.status(200).json({
      success: true,
      message: 'Batch deleted successfully',
      data: null
    });
  }
}

export const batchController = new BatchController();
