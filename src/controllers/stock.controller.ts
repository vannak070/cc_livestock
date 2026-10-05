import { Request, Response } from 'express';
import { farmGuard } from '../lib/farm-guard';
import type { AuthedRequest } from '../middleware/auth.middleware';
import { scopeFor } from '../lib/farm-scope';
import { stockService } from '../services/stock.service';

export class StockController {
  async getAll(req: Request, res: Response): Promise<void> {
    const stock = await stockService.getAllStock(scopeFor((req as AuthedRequest).actor ?? {}));
    res.status(200).json({
      success: true,
      message: 'Stock items retrieved successfully',
      data: stock
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.cows((req as AuthedRequest).actor!, [id]);
    const stock = await stockService.getStockById(id);
    if (!stock) {
      res.status(404).json({
        success: false,
        message: `Cow with ID ${id} not found`,
        data: null
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Stock item retrieved successfully',
      data: stock
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    farmGuard.requireLocation((req as AuthedRequest).actor!, req.body?.location);
    const newItem = await stockService.createStock(req.body);
    res.status(201).json({
      success: true,
      message: 'Stock item created successfully',
      data: newItem
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.cows((req as AuthedRequest).actor!, [id]);
    farmGuard.location((req as AuthedRequest).actor!, req.body?.location);
    const updated = await stockService.updateStock(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Stock item updated successfully',
      data: updated
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await farmGuard.cows((req as AuthedRequest).actor!, [id]);
    const deleted = await stockService.deleteStock(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: `Cow with ID ${id} not found`,
        data: null
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Stock item deleted successfully',
      data: null
    });
  }
}

export const stockController = new StockController();
