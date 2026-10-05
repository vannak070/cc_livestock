'use server';

import { 
  getDbData, 
  addStockItem, 
  updateStockItem, 
  addWeightRecord, 
  recordSale,
  recordBatchSale,
  updateSettings,
  createBatch,
  assignCowsToBatch,
  addHealthLog,
  removeCowFromBatch,
  updateBatch,
  recordBatchWeights,
  recordBatchHealthLog,
  deleteStockItem,
  deleteBatch,
  deleteHealthLog,
  updateHealthLog,
  deleteWeightRecord,
  updateWeightRecord,
  deleteSalesRecord,
  updateSalesRecord,
  addFeedTransaction,
  saveProposalPlan,
  deleteProposalPlan,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
  deleteUser,
  saveFarm,
  deleteFarm,
  setFarmOwner
} from '@/lib/db';
import type { PersonInput } from '@/lib/user-admin';
import type { FarmInput } from '@/lib/farm-settings';
import { StockItem, WeightRecord, SalesRecord } from '@/lib/xlsx-parser';
import { MasterSetup, BatchItem, HealthLogItem, FeedProductItem, FeedStockTransaction, ProposalPlanParams } from '@/lib/types';
import { runAction } from '@/lib/run-action';
import { authService } from '@/services/auth.service';
import { dailyFeedService } from '@/services/daily-feed.service';
import { farmCostService } from '@/services/farm-cost.service';
import type { FarmCostInput } from '@/lib/farm-costs';
import { batchMoveService } from '@/services/batch-move.service';
import type { DailyFeedInput } from '@/lib/daily-feed';
import { startSession, endSession } from '@/lib/session';
import { scopeDataForActor } from '@/lib/data-scope';
import { scopeFor } from '@/lib/farm-scope';
import { farmGuard } from '@/lib/farm-guard';
import { assertPlanningAccess } from '@/lib/authz';
import { feedProductService } from '@/services/feed-product.service';
import { saleReviewService } from '@/services/sale-review.service';
import type { SaleReviewInput } from '@/lib/sale-review';

// Every action below is a public endpoint as far as the network is
// concerned. runAction (src/lib/run-action.ts) checks the caller's session and
// permissions before any of them touches the database, and farmGuard
// (src/lib/farm-guard.ts) stops a farm-bound user reaching another farm's
// records by id.

export async function loginAction(email: string, password: string) {
  try {
    const { user } = await authService.login(email, password);
    await startSession(user);
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: err instanceof Error && err.message ? err.message : 'Invalid email or password.' };
  }
}

export async function logoutAction() {
  await endSession();
  return { success: true as const };
}

export async function getLivestockDataAction() {
  return runAction('Failed to fetch livestock data', [], async actor => scopeDataForActor(await getDbData(scopeFor(actor)), actor), { revalidate: false });
}

// ─── Stock ──────────────────────────────────────────────────────────────────
export async function addStockItemAction(item: Omit<StockItem, 'no'>) {
  return runAction('Failed to add stock item', ['stock_create'], async actor => {
    farmGuard.requireLocation(actor, item.location);
    return addStockItem(item);
  });
}

export async function updateStockItemAction(id: string, updates: Partial<StockItem>) {
  return runAction('Failed to update stock item', ['stock_edit'], async actor => {
    await farmGuard.cows(actor, [id]);
    farmGuard.location(actor, updates.location);
    return updateStockItem(id, updates);
  });
}

export async function deleteStockItemAction(cowId: string) {
  return runAction('Failed to delete stock item', ['stock_delete'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return deleteStockItem(cowId);
  });
}

// ─── Weight ─────────────────────────────────────────────────────────────────
export async function addWeightRecordAction(cowId: string, currentWeight: number, healthStatus: string, trackingDate?: string) {
  return runAction('Failed to add weight record', ['weight_record'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return addWeightRecord(cowId, currentWeight, healthStatus, trackingDate);
  });
}

export async function updateWeightRecordAction(cowId: string, trackingDate: string, currentWeight: number, healthStatus: string) {
  return runAction('Failed to update weight record', ['weight_record'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return updateWeightRecord(cowId, trackingDate, currentWeight, healthStatus);
  });
}

export async function deleteWeightRecordAction(cowId: string, trackingDate: string) {
  return runAction('Failed to delete weight record', ['weight_delete'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return deleteWeightRecord(cowId, trackingDate);
  });
}

export async function recordBatchWeightsAction(records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]) {
  return runAction('Failed to record batch weights', ['weight_record'], async actor => {
    await farmGuard.cows(actor, records.map(r => r.cowId));
    return recordBatchWeights(records);
  });
}

// ─── Sales ──────────────────────────────────────────────────────────────────
export async function recordSaleAction(cowId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string, buyer?: string) {
  return runAction('Failed to record sale', ['sales_record'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return recordSale(cowId, unitPrice, saleType, salesDate, buyer);
  });
}

export async function recordBatchSaleAction(batchId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string) {
  return runAction('Failed to record batch sale', ['sales_record'], async actor => {
    await farmGuard.batch(actor, batchId);
    return recordBatchSale(batchId, unitPrice, saleType, salesDate);
  });
}

export async function updateSalesRecordAction(cowId: string, updates: Partial<SalesRecord>) {
  return runAction('Failed to update sales record', ['sales_record'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return updateSalesRecord(cowId, updates);
  });
}

export async function deleteSalesRecordAction(cowId: string) {
  return runAction('Failed to delete sales record', ['sales_delete'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return deleteSalesRecord(cowId);
  });
}

// ─── Batches ────────────────────────────────────────────────────────────────
export async function createBatchAction(batch: Omit<BatchItem, 'cowIds'>) {
  return runAction('Failed to create batch', ['batch_create'], async actor => {
    farmGuard.requireLocation(actor, batch.farmLocation);
    return createBatch(batch);
  });
}

// Management (or the farm owner, for their own farm) decides whether a batch near its selling date is sold or fed longer.
export async function reviewBatchSaleAction(batchId: string, input: SaleReviewInput) {
  return runAction('Failed to save the review', ['batch_review'], async actor => {
    await farmGuard.batch(actor, batchId);
    return saleReviewService.review(actor, batchId, input);
  });
}

export async function updateBatchAction(batchId: string, updates: Partial<BatchItem>) {
  return runAction('Failed to update batch details', ['batch_edit'], async actor => {
    await farmGuard.batch(actor, batchId);
    farmGuard.location(actor, updates.farmLocation);
    if (updates.cowIds) await farmGuard.cows(actor, updates.cowIds);
    return updateBatch(batchId, updates);
  });
}

export async function assignCowsToBatchAction(batchId: string, cowIds: string[]) {
  return runAction('Failed to assign cows', ['batch_edit'], async actor => {
    await farmGuard.batch(actor, batchId);
    await farmGuard.cows(actor, cowIds);
    return assignCowsToBatch(batchId, cowIds);
  });
}

export async function removeCowFromBatchAction(batchId: string, cowId: string) {
  return runAction('Failed to remove cow from batch', ['batch_edit'], async actor => {
    await farmGuard.batch(actor, batchId);
    await farmGuard.cows(actor, [cowId]);
    return removeCowFromBatch(batchId, cowId);
  });
}

// Moving a batch between farms is for the office; it can take the batch's cattle along.
export async function moveBatchFarmAction(batchId: string, farm: string, moveCattle: boolean) {
  return runAction('Failed to move the batch', ['batch_edit'], actor => batchMoveService.moveToFarm(actor, batchId, farm, moveCattle));
}

export async function moveCowToBatchAction(cowId: string, fromBatchId: string, toBatchId: string) {
  return runAction('Failed to move the animal', ['batch_edit'], actor => batchMoveService.moveCow(actor, cowId, fromBatchId, toBatchId));
}

export async function deleteBatchAction(batchId: string) {
  return runAction('Failed to delete batch', ['batch_delete'], async actor => {
    await farmGuard.batch(actor, batchId);
    return deleteBatch(batchId);
  });
}

// ─── Health ─────────────────────────────────────────────────────────────────
export async function addHealthLogAction(log: Omit<HealthLogItem, 'id'>) {
  return runAction('Failed to add medical/vaccination log', ['health_record'], async actor => {
    await farmGuard.cows(actor, [log.cowId]);
    return addHealthLog(log);
  });
}

export async function updateHealthLogAction(logId: string, updates: Partial<HealthLogItem>) {
  return runAction('Failed to update health log', ['health_record'], async actor => {
    await farmGuard.healthLog(actor, logId);
    await farmGuard.cows(actor, [updates.cowId]);
    return updateHealthLog(logId, updates);
  });
}

export async function deleteHealthLogAction(logId: string) {
  return runAction('Failed to delete health log', ['health_delete'], async actor => {
    await farmGuard.healthLog(actor, logId);
    return deleteHealthLog(logId);
  });
}

export async function recordBatchHealthLogAction(batchId: string, log: Omit<HealthLogItem, 'id' | 'cowId'>) {
  return runAction('Failed to record batch health log', ['health_record'], async actor => {
    await farmGuard.batch(actor, batchId);
    return recordBatchHealthLog(batchId, log);
  });
}

// ─── Feed ───────────────────────────────────────────────────────────────────
export async function saveFeedProductAction(product: FeedProductItem) {
  return runAction('Failed to save feed product', ['feed_manage', 'feed_own_products'], actor => feedProductService.save(actor, product));
}

export async function deleteFeedProductAction(productId: string) {
  return runAction('Failed to delete feed product', ['feed_manage', 'feed_own_products'], actor => feedProductService.remove(actor, productId));
}

export async function addFeedTransactionAction(tx: FeedStockTransaction) {
  return runAction('Failed to add feed transaction', ['feed_manage', 'feed_own_products'], async actor => {
    await feedProductService.assertCanMove(actor, tx);
    return addFeedTransaction(tx);
  });
}

// A farm account records its own farm; the office can record any farm for them.
export async function recordDailyFeedAction(input: DailyFeedInput) {
  return runAction('Failed to save the day\'s feed', ['feed_record'], actor => dailyFeedService.record(actor, input));
}

// ─── Running costs ──────────────────────────────────────────────────────────
// A farm account can only record or delete its own farm's costs (checked in the service).
export async function addFarmCostAction(input: FarmCostInput) {
  return runAction('Failed to save the cost', ['costs_record'], actor => farmCostService.add(actor, input));
}

export async function deleteFarmCostAction(id: string) {
  return runAction('Failed to delete the cost', ['costs_delete'], actor => farmCostService.remove(actor, id));
}

// ─── Settings & planning ────────────────────────────────────────────────────
// Which parts of settings this user may change is checked section by section
// inside the settings service, so no blanket permission is required here.
export async function updateSettingsAction(settings: Partial<MasterSetup>) {
  return runAction('Failed to update setup configurations', [], actor => updateSettings(settings, actor));
}

// People and farms are changed one at a time, so a screen that is out of date can never delete anyone else.
export async function createUserAction(input: PersonInput) {
  return runAction('Failed to add the person', [], actor => createUser(actor, input));
}
export async function updateUserAction(id: string, input: PersonInput) {
  return runAction('Failed to save the person', [], actor => updateUser(actor, id, input));
}
export async function setUserStatusAction(id: string, status: 'Active' | 'Inactive') {
  return runAction('Failed to change the person', [], actor => setUserStatus(actor, id, status));
}
export async function resetUserPasswordAction(id: string) {
  return runAction('Failed to make a new password', [], actor => resetUserPassword(actor, id));
}
export async function deleteUserAction(id: string) {
  return runAction('Failed to remove the person', [], actor => deleteUser(actor, id));
}
export async function saveFarmAction(input: FarmInput, farmId: string | null) {
  return runAction('Failed to save the farm', ['farms_manage', 'settings_manage'], actor => {
    farmGuard.notFarmBound(actor);
    return saveFarm(actor, input, farmId);
  });
}
export async function setFarmOwnerAction(farmId: string, userId: string) {
  return runAction('Failed to choose the owner', ['farms_manage', 'settings_manage'], actor => {
    farmGuard.notFarmBound(actor);
    return setFarmOwner(actor, farmId, userId);
  });
}
export async function deleteFarmAction(farmId: string) {
  return runAction('Failed to delete the farm', ['farms_manage', 'settings_manage'], actor => {
    farmGuard.notFarmBound(actor);
    return deleteFarm(actor, farmId);
  });
}

export async function saveProposalPlanAction(slot: number, name: string, params: ProposalPlanParams) {
  return runAction('Failed to save plan', [], actor => {
    assertPlanningAccess(actor);
    return saveProposalPlan(slot, name, params, actor.name);
  });
}

export async function deleteProposalPlanAction(slot: number) {
  return runAction('Failed to delete plan', [], actor => {
    assertPlanningAccess(actor);
    return deleteProposalPlan(slot);
  });
}
