import { Request, Response } from 'express';
import { farmGuard } from '../lib/farm-guard';
import type { AuthedRequest } from '../middleware/auth.middleware';
import { scopeFor } from '../lib/farm-scope';
import { salesService } from '../services/sales.service';

export class SalesController {
  async getAll(req: Request, res: Response): Promise<void> {
    const sales = await salesService.getAllSales(scopeFor((req as AuthedRequest).actor ?? {}));
    res.status(200).json({
      success: true,
      message: 'Sales records retrieved successfully',
      data: sales
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    const { cowId, unitPrice, saleType, salesDate, buyer } = req.body;
    await farmGuard.cows((req as AuthedRequest).actor!, [cowId]);
    if (!cowId || unitPrice === undefined || !saleType) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: cowId, unitPrice, saleType',
        data: null
      });
      return;
    }

    const record = await salesService.recordSale(cowId, Number(unitPrice), saleType, salesDate, buyer);
    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      data: record
    });
  }

  async recordBatchSale(req: Request, res: Response): Promise<void> {
    const { batchId, unitPrice, saleType, salesDate } = req.body;
    await farmGuard.batch((req as AuthedRequest).actor!, String(batchId));
    if (!batchId || unitPrice === undefined || !saleType) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: batchId, unitPrice, saleType',
        data: null
      });
      return;
    }

    const records = await salesService.recordBatchSale(batchId, Number(unitPrice), saleType, salesDate);
    res.status(200).json({
      success: true,
      message: 'Batch sale recorded successfully',
      data: records
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const cowId = String(req.params.cowId);
    await farmGuard.cows((req as AuthedRequest).actor!, [cowId]);
    const updated = await salesService.updateSalesRecord(cowId, req.body);
    res.status(200).json({
      success: true,
      message: 'Sales record updated successfully',
      data: updated
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const cowId = String(req.params.cowId);
    await farmGuard.cows((req as AuthedRequest).actor!, [cowId]);
    await salesService.deleteSalesRecord(cowId);
    res.status(200).json({
      success: true,
      message: 'Sales record deleted successfully',
      data: null
    });
  }
}

export const salesController = new SalesController();
