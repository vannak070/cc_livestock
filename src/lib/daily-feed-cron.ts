/**
 * AUTOMATED DAILY FEED RATION CRON & STOCK-OUT DEDUCTION ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculates and automatically logs daily feed STOCK_OUT transactions based
 * on active Fattening Batches' Daily Feed Ration specifications set by farm owner.
 *
 * Run on a timer by the API server (src/server/index.ts) and on demand with
 * `npm run feed:daily`. Idempotent: a unique index on the AUTO-RATION reference
 * number guarantees one deduction per batch/day/ingredient.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ERPLivestockData, FeedStockTransaction, FeedProductItem } from './types';
import { feedRepository } from '../repositories/feed.repository';
import { batchService } from '../services/batch.service';

const MAX_CATCH_UP_DAYS = 60;

/** Loads what the ration job needs and applies any missing daily deductions. Safe to call repeatedly and from several processes. */
export async function runDailyFeedStockOuts(): Promise<number> {
  const [batches, feedProducts, feedTransactions] = await Promise.all([
    batchService.getAllBatches(),
    feedRepository.getProducts(),
    feedRepository.getTransactions()
  ]);
  return processDailyFeedStockOuts({ batches, feedProducts, feedTransactions } as ERPLivestockData);
}

export async function processDailyFeedStockOuts(data: ERPLivestockData): Promise<number> {
  const activeBatches = (data.batches || []).filter(b => b.status === 'Active');
  const products = data.feedProducts || [];
  const existingTransactions = data.feedTransactions || [];

  if (activeBatches.length === 0 || products.length === 0) {
    return 0;
  }

  const existingRefNos = new Set(
    existingTransactions
      .map(t => t.referenceNo)
      .filter(Boolean) as string[]
  );

  let newTxCount = 0;
  const today = new Date();

  for (const batch of activeBatches) {
    if (!batch.feedingProgram || batch.feedingProgram.status !== 'Active') continue;
    const headcount = batch.cowIds ? batch.cowIds.length : 0;
    if (headcount <= 0) continue;

    const farmLocation = batch.farmLocation || 'Farm';
    const earliest = new Date(today.getTime() - MAX_CATCH_UP_DAYS * 86400000);
    const requested = batch.startDate ? new Date(batch.startDate) : new Date(today.getTime() - 7 * 86400000);
    const startDate = requested < earliest ? earliest : requested;

    // Generate daily stock out records from start date up to today (max 60 days catch-up)
    const curDate = new Date(startDate);

    while (curDate <= today) {
      const dateStr = curDate.toISOString().split('T')[0];
      const ingredients = batch.feedingProgram.ingredients || [];

      for (let idx = 0; idx < ingredients.length; idx++) {
        const ing = ingredients[idx];
        const portionKg = ing.portionPerHead || 0;
        if (portionKg <= 0) continue;

        // Match ingredient to feed product catalog
        const ingNameLower = ing.name.toLowerCase();
        const matchedProd = products.find(p =>
          p.name.toLowerCase().includes(ingNameLower) ||
          ingNameLower.includes(p.name.toLowerCase()) ||
          p.id.toLowerCase() === ingNameLower
        ) || products[0];

        const refNo = `AUTO-RATION-${batch.id}-${dateStr}-${idx}`;

        if (!existingRefNos.has(refNo)) {
          const totalKg = portionKg * headcount;
          const weightPerUnit = matchedProd.weightPerUnit || 30;
          const totalBags = parseFloat((totalKg / weightPerUnit).toFixed(2));
          const unitCost = matchedProd.unitCost || 0;
          const totalCost = parseFloat((totalKg * unitCost).toFixed(2));

          const autoTx: FeedStockTransaction = {
            id: `TX-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: dateStr,
            productId: matchedProd.id,
            productName: matchedProd.name,
            type: 'STOCK_OUT',
            quantityBags: totalBags,
            quantityKg: totalKg,
            unitCost,
            totalCost,
            sourceFarm: farmLocation,
            targetFarm: `Daily Feed Ration (${batch.name})`,
            referenceNo: refNo,
            recordedBy: 'Daily Automated Feed Cron',
            notes: `Automated daily feed ration deduction (${portionKg} kg/head/day x ${headcount} head) for ${batch.name}`,
            createdAt: new Date().toISOString()
          };

          try {
            // false = another run already wrote this day's row (unique index).
            if (await feedRepository.addTransactionIfNew(autoTx)) newTxCount++;
            existingRefNos.add(refNo);
          } catch (err) {
            console.error('[processDailyFeedStockOuts] Failed to record auto tx:', err);
          }
        }
      }

      // Increment 1 day
      curDate.setDate(curDate.getDate() + 1);
    }
  }

  if (newTxCount > 0) {
    console.log(`[Daily Feed Cron] Successfully generated ${newTxCount} automated daily feed STOCK_OUT transactions.`);
  }

  return newTxCount;
}
