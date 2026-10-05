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

import { ERPLivestockData, FeedStockTransaction } from './types';
import { feedRepository } from '../repositories/feed.repository';
import { batchService } from '../services/batch.service';
import { stockService } from '../services/stock.service';
import { activeCattleIds, activeHeadcount, matchIngredientProduct } from './feed-math';
import { addDays, autoRefPrefix, farmToday, kgPerUnit, parseFeedRef } from './daily-feed';

/** How far back the job fills in days it missed (for example while the server was off). */
const MAX_CATCH_UP_DAYS = 60;

/** Loads what the ration job needs and applies any missing daily deductions. Safe to call repeatedly and from several processes. */
export async function runDailyFeedStockOuts(): Promise<number> {
  const [stock, batches, feedProducts, feedTransactions] = await Promise.all([
    stockService.getAllStock(),
    batchService.getAllBatches(),
    feedRepository.getProducts(),
    feedRepository.getTransactions()
  ]);
  return processDailyFeedStockOuts({ stock, batches, feedProducts, feedTransactions } as ERPLivestockData);
}

/**
 * Writes the planned feed as an estimate for each day a batch was fed but
 * nobody recorded what it ate. Rules:
 * - a day the farm recorded (a DAILY- record) is never estimated;
 * - it starts the day after the batch's last record or estimate, or today for
 *   a batch that has none, so adding a feed to a plan never charges past days;
 * - a plan feed that is not clearly one product in the feed list is skipped
 *   (the screens ask which feed it is) instead of using a guessed feed;
 * - days are Phnom Penh calendar days.
 */
export async function processDailyFeedStockOuts(data: ERPLivestockData, now: Date = new Date()): Promise<number> {
  const activeBatches = (data.batches || []).filter(b => b.status === 'Active');
  const activeIds = activeCattleIds(data.stock || []);
  const products = data.feedProducts || [];
  const existing = data.feedTransactions || [];
  if (activeBatches.length === 0 || products.length === 0) return 0;

  const today = farmToday(now);
  const earliest = addDays(today, -MAX_CATCH_UP_DAYS);
  // Per batch: the last day that has a record or an estimate, and the days the farm recorded.
  const lastDay = new Map<string, string>();
  const recordedDays = new Set<string>();
  const existingRefs = new Set<string>();
  for (const t of existing) {
    if (t.referenceNo) existingRefs.add(t.referenceNo);
    const ref = parseFeedRef(t.referenceNo);
    if (!ref) continue;
    if (ref.day > (lastDay.get(ref.batchId) ?? '')) lastDay.set(ref.batchId, ref.day);
    if (ref.kind === 'recorded') recordedDays.add(`${ref.batchId}|${ref.day}`);
  }

  let newTxCount = 0;
  for (const batch of activeBatches) {
    if (!batch.feedingProgram || batch.feedingProgram.status !== 'Active') continue;
    // Only cattle still on the farm eat: sold or dead cattle can stay listed on a batch for its history.
    const headcount = activeHeadcount(batch, activeIds);
    if (headcount <= 0) continue;

    const last = lastDay.get(batch.id);
    let day = last ? addDays(last, 1) : today;
    if (day < earliest) day = earliest;
    const startDay = (batch.startDate || '').slice(0, 10);
    if (startDay && day < startDay) day = startDay;

    for (; day <= today; day = addDays(day, 1)) {
      if (recordedDays.has(`${batch.id}|${day}`)) continue;
      for (const ing of batch.feedingProgram.ingredients || []) {
        const portionKg = ing.portionPerHead || 0;
        if (portionKg <= 0) continue;
        const product = matchIngredientProduct(ing, products);
        if (!product) continue;

        const refNo = `${autoRefPrefix(batch.id, day)}${product.id}`;
        if (existingRefs.has(refNo)) continue;
        const totalKg = portionKg * headcount;
        const unitCost = product.unitCost || 0;
        const autoTx: FeedStockTransaction = {
          id: `TX-AUTO-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          date: day,
          productId: product.id,
          productName: product.name,
          type: 'STOCK_OUT',
          quantityBags: parseFloat((totalKg / kgPerUnit(product)).toFixed(2)),
          quantityKg: totalKg,
          unitCost,
          totalCost: parseFloat((totalKg * unitCost).toFixed(2)),
          sourceFarm: batch.farmLocation || 'Farm',
          targetFarm: `Daily Feed Ration (${batch.name})`,
          referenceNo: refNo,
          recordedBy: 'Daily Automated Feed Cron',
          notes: `Estimated from the feeding plan (${portionKg} kg/head/day x ${headcount} head) for ${batch.name}; nobody recorded this day`,
          createdAt: new Date().toISOString()
        };
        try {
          // false = another run already wrote this row (unique index).
          if (await feedRepository.addTransactionIfNew(autoTx)) newTxCount++;
          existingRefs.add(refNo);
        } catch (err) {
          console.error('[processDailyFeedStockOuts] Failed to record auto tx:', err);
        }
      }
    }
  }

  if (newTxCount > 0) {
    console.log(`[Daily Feed Cron] Wrote ${newTxCount} estimated daily feed STOCK_OUT transactions.`);
  }
  return newTxCount;
}
