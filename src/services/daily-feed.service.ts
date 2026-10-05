import { withTransaction } from '../config/database';
import { feedRepository } from '../repositories/feed.repository';
import { batchService } from './batch.service';
import { stockService } from './stock.service';
import { Actor } from '../lib/authz';
import { farmGuard } from '../lib/farm-guard';
import {
  autoRefPrefix, dailyFeedProblem, dailyRef, dailyRefPrefix, farmRations, farmToday, kgPerUnit, round1, unitWord, feedUnit,
  type DailyFeedInput
} from '../lib/daily-feed';
import type { FeedStockTransaction } from '../lib/types';

/**
 * Writing down what each batch on a farm ate on a day. A farm account can
 * only record its own farm; office accounts can record any farm for them.
 * Recording a day replaces that day's estimate (and any earlier record), all
 * in one transaction, so stock is never taken twice for the same day.
 */
export class DailyFeedService {
  async record(actor: Actor, input: DailyFeedInput): Promise<{ rows: number }> {
    const problem = dailyFeedProblem(input, farmToday());
    if (problem) throw new Error(problem);
    farmGuard.requireLocation(actor, input.farm);

    const [batches, stock, products] = await Promise.all([
      batchService.getAllBatches(),
      stockService.getAllStock(),
      feedRepository.getProducts()
    ]);
    const rations = new Map(farmRations(input.farm, batches, stock, products).map(r => [r.batch.id, r]));
    const productById = new Map(products.map(p => [p.id, p]));

    const perBatch: { batchId: string; rows: FeedStockTransaction[] }[] = [];
    for (const b of input.batches) {
      // Nothing to write for this batch: leave its day (estimate or record) as it is.
      if (b.items.length === 0) continue;
      const ration = rations.get(b.batchId);
      if (!ration) throw new Error('One of the batches is not being fed on this farm any more. Reload the page and try again.');
      const seen = new Set<string>();
      const rows: FeedStockTransaction[] = [];
      for (const item of b.items) {
        const product = productById.get(item.productId);
        if (!product) throw new Error('One of the feeds is no longer in the feed list. Reload the page and try again.');
        if (seen.has(product.id)) throw new Error(`${product.name} is listed twice for ${ration.batch.name}.`);
        seen.add(product.id);
        const units = round1(item.units);
        const kg = round1(units * kgPerUnit(product));
        const unitCost = product.unitCost || 0;
        rows.push({
          id: `TX-DAY-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          date: input.day,
          productId: product.id,
          productName: product.name,
          type: 'STOCK_OUT',
          // quantityBags holds the amount in the feed's own unit (bags, bales, or kg for loose feed).
          quantityBags: units,
          quantityKg: kg,
          unitCost,
          totalCost: Math.round(kg * unitCost),
          sourceFarm: input.farm,
          targetFarm: `Daily Feed Ration (${ration.batch.name})`,
          referenceNo: dailyRef(ration.batch.id, input.day, product.id),
          recordedBy: actor.name,
          notes: `Fed ${units} ${unitWord(feedUnit(product), units)} to ${ration.head} head of ${ration.batch.name}`,
          createdAt: new Date().toISOString()
        });
      }
      perBatch.push({ batchId: ration.batch.id, rows });
    }

    await withTransaction(async client => {
      for (const b of perBatch) {
        await feedRepository.replaceDailyFeed(autoRefPrefix(b.batchId, input.day), dailyRefPrefix(b.batchId, input.day), b.rows, client);
      }
    });
    return { rows: perBatch.reduce((s, b) => s + b.rows.length, 0) };
  }
}

export const dailyFeedService = new DailyFeedService();
