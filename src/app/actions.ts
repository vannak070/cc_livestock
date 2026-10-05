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
  updateStockLocation,
  saveFeedProduct,
  deleteFeedProduct,
  addFeedTransaction,
  saveProposalPlan
} from '@/lib/db';
import { StockItem, WeightRecord, SalesRecord } from '@/lib/xlsx-parser';
import { MasterSetup, BatchItem, HealthLogItem, FeedProductItem, FeedStockTransaction, ProposalPlanParams } from '@/lib/types';
import { runAction } from '@/lib/run-action';
import { authService } from '@/services/auth.service';
import { startSession, endSession } from '@/lib/session';
import { scopeDataForActor } from '@/lib/data-scope';
import { scopeFor } from '@/lib/farm-scope';

// Every action below is a public endpoint as far as the network is
// concerned. runAction (src/lib/run-action.ts) checks the caller's session and
// permissions before any of them touches the database.

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
  return runAction('Failed to add stock item', ['stock_create'], () => addStockItem(item));
}

export async function updateStockItemAction(id: string, updates: Partial<StockItem>) {
  return runAction('Failed to update stock item', ['stock_edit'], () => updateStockItem(id, updates));
}

export async function updateStockLocationAction(oldLocation: string, newLocation: string) {
  return runAction('Failed to update stock location', ['farms_manage', 'settings_manage'], () => updateStockLocation(oldLocation, newLocation));
}

export async function deleteStockItemAction(cowId: string) {
  return runAction('Failed to delete stock item', ['stock_delete'], () => deleteStockItem(cowId));
}

// ─── Weight ─────────────────────────────────────────────────────────────────
export async function addWeightRecordAction(cowId: string, currentWeight: number, healthStatus: string, trackingDate?: string) {
  return runAction('Failed to add weight record', ['weight_record'], () => addWeightRecord(cowId, currentWeight, healthStatus, trackingDate));
}

export async function updateWeightRecordAction(cowId: string, trackingDate: string, currentWeight: number, healthStatus: string) {
  return runAction('Failed to update weight record', ['weight_record'], () => updateWeightRecord(cowId, trackingDate, currentWeight, healthStatus));
}

export async function deleteWeightRecordAction(cowId: string, trackingDate: string) {
  return runAction('Failed to delete weight record', ['weight_delete'], () => deleteWeightRecord(cowId, trackingDate));
}

export async function recordBatchWeightsAction(records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]) {
  return runAction('Failed to record batch weights', ['weight_record'], () => recordBatchWeights(records));
}

// ─── Sales ──────────────────────────────────────────────────────────────────
export async function recordSaleAction(cowId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string, buyer?: string) {
  return runAction('Failed to record sale', ['sales_record'], () => recordSale(cowId, unitPrice, saleType, salesDate, buyer));
}

export async function recordBatchSaleAction(batchId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string) {
  return runAction('Failed to record batch sale', ['sales_record'], () => recordBatchSale(batchId, unitPrice, saleType, salesDate));
}

export async function updateSalesRecordAction(cowId: string, updates: Partial<SalesRecord>) {
  return runAction('Failed to update sales record', ['sales_record'], () => updateSalesRecord(cowId, updates));
}

export async function deleteSalesRecordAction(cowId: string) {
  return runAction('Failed to delete sales record', ['sales_delete'], () => deleteSalesRecord(cowId));
}

// ─── Batches ────────────────────────────────────────────────────────────────
export async function createBatchAction(batch: Omit<BatchItem, 'cowIds'>) {
  return runAction('Failed to create batch', ['batch_create'], () => createBatch(batch));
}

export async function updateBatchAction(batchId: string, updates: Partial<BatchItem>) {
  return runAction('Failed to update batch details', ['batch_edit'], () => updateBatch(batchId, updates));
}

export async function assignCowsToBatchAction(batchId: string, cowIds: string[]) {
  return runAction('Failed to assign cows', ['batch_edit'], () => assignCowsToBatch(batchId, cowIds));
}

export async function removeCowFromBatchAction(batchId: string, cowId: string) {
  return runAction('Failed to remove cow from batch', ['batch_edit'], () => removeCowFromBatch(batchId, cowId));
}

export async function deleteBatchAction(batchId: string) {
  return runAction('Failed to delete batch', ['batch_delete'], () => deleteBatch(batchId));
}

// ─── Health ─────────────────────────────────────────────────────────────────
export async function addHealthLogAction(log: Omit<HealthLogItem, 'id'>) {
  return runAction('Failed to add medical/vaccination log', ['health_record'], () => addHealthLog(log));
}

export async function updateHealthLogAction(logId: string, updates: Partial<HealthLogItem>) {
  return runAction('Failed to update health log', ['health_record'], () => updateHealthLog(logId, updates));
}

export async function deleteHealthLogAction(logId: string) {
  return runAction('Failed to delete health log', ['health_delete'], () => deleteHealthLog(logId));
}

export async function recordBatchHealthLogAction(batchId: string, log: Omit<HealthLogItem, 'id' | 'cowId'>) {
  return runAction('Failed to record batch health log', ['health_record'], () => recordBatchHealthLog(batchId, log));
}

// ─── Feed ───────────────────────────────────────────────────────────────────
export async function saveFeedProductAction(product: FeedProductItem) {
  return runAction('Failed to save feed product', ['feed_manage'], () => saveFeedProduct(product));
}

export async function deleteFeedProductAction(productId: string) {
  return runAction('Failed to delete feed product', ['feed_manage'], () => deleteFeedProduct(productId));
}

export async function addFeedTransactionAction(tx: FeedStockTransaction) {
  return runAction('Failed to add feed transaction', ['feed_manage'], () => addFeedTransaction(tx));
}

// ─── Settings & planning ────────────────────────────────────────────────────
// Which parts of settings this user may change is checked section by section
// inside the settings service, so no blanket permission is required here.
export async function updateSettingsAction(settings: MasterSetup) {
  return runAction('Failed to update setup configurations', [], actor => updateSettings(settings, actor));
}

export async function saveProposalPlanAction(params: ProposalPlanParams) {
  return runAction('Failed to save proposal plan', ['analytics_view'], () => saveProposalPlan(params));
}
