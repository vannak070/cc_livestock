import fs from 'fs';
import path from 'path';
import { ERPLivestockData, BatchItem, HealthLogItem, MasterSetup } from './types';
import { StockItem, WeightRecord, SalesRecord } from './xlsx-parser';

import { stockService } from '../services/stock.service';
import { weightService } from '../services/weight.service';
import { salesService } from '../services/sales.service';
import { batchService } from '../services/batch.service';
import { healthService } from '../services/health.service';
import { settingsService } from '../services/settings.service';
import { feedRepository } from '../repositories/feed.repository';
import { proposalPlanRepository } from '../repositories/proposal-plan.repository';
import { proposalPlanService } from '../services/proposal-plan.service';
import { userAdminService } from '../services/user-admin.service';
import { farmService } from '../services/farm.service';
import type { PersonInput } from './user-admin';
import type { FarmInput } from './farm-settings';
import { FeedProductItem, FeedStockTransaction, ProposalPlanParams, ProposalPlanRecord } from './types';

import { Actor, AuthzError } from './authz';
import type { FarmScope } from './farm-scope';

const dbPath = path.join(process.cwd(), 'src/data/db.json');

/**
 * PostgreSQL is the single source of truth for every record in this system.
 *
 * db.json is a READ-ONLY emergency snapshot: if the database is unreachable,
 * the app can still *display* the last known data instead of showing nothing.
 * Nothing is ever written back to it — a save that cannot reach the database
 * fails loudly (see `requireDb` below) rather than quietly landing in a file
 * that no one else, and no other machine, can see.
 */
function getJsonDbData(): ERPLivestockData {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }
  const content = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(content);

  if (!parsed.batches) parsed.batches = [];
  if (!parsed.healthLogs) parsed.healthLogs = [];
  if (!parsed.settings) parsed.settings = {};

  // Dropdown option lists only — these are UI choices, not business records,
  // and they exist so an offline read doesn't render empty selects.
  parsed.settings.breeds = parsed.settings.breeds || parsed.common?.breeds || ['គោទន្លេ', 'កាត់ Brahman', 'កាត់ Wagyu'];
  parsed.settings.buyTypes = parsed.settings.buyTypes || parsed.common?.buyTypes || ['Lumsum', 'Weight', 'Born in Farm', 'Transfer', 'Partnership'];
  parsed.settings.healthStatuses = parsed.settings.healthStatuses || parsed.common?.healthStatuses || ['Good', 'Fair', 'Poor', 'Dead'];
  parsed.settings.vaccineTypes = parsed.settings.vaccineTypes || ['Foot and Mouth', 'Brucellosis', 'Anthrax', 'Dewormer A', 'Vitamin Boost'];
  parsed.settings.feedTypes = parsed.settings.feedTypes || ['Silage', 'Concentrate Feed', 'Fresh Grass', 'Hay Mix'];
  parsed.settings.paymentMethods = parsed.settings.paymentMethods || ['ABA Pay', 'Cash', 'Bank Transfer'];
  parsed.settings.sexes = parsed.settings.sexes || ['Male', 'Female'];
  parsed.settings.diseaseTypes = parsed.settings.diseaseTypes || ['Foot and Mouth Disease (FMD)', 'Brucellosis', 'Anthrax', 'Pneumonia', 'Parasite Infection'];
  parsed.settings.batchTypes = ['Fattening Program', 'Quanrantin & Vet Card', 'Selling Pool'];
  parsed.settings.weightUnits = parsed.settings.weightUnits || ['kg', 'lbs'];
  parsed.settings.revenueTypes = parsed.settings.revenueTypes || ['Livestock Sale', 'Manure Sale', 'Milk Sale', 'Partnership Share'];
  parsed.settings.purchaseTypes = parsed.settings.purchaseTypes || ['Purchase', 'Born in Farm', 'Transfer', 'Partnership'];

  // Accounts are never invented. If this snapshot carries none, it carries
  // none — the real roster lives in the database's `users` table, and the
  // first account is created with `npm run create-admin`.
  if (!parsed.settings.users) parsed.settings.users = [];

  return parsed as ERPLivestockData;
}

/**
 * Runs a write against PostgreSQL and, if it cannot be completed, throws
 * instead of diverting the record somewhere else. A failed save must be
 * visible: the alternative — reporting success while the row exists only in
 * a local file — silently splits the system's data across two places.
 */
async function requireDb<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof AuthzError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[db] ${operation} failed — nothing was saved:`, detail);
    throw new Error(`Could not save to the database (${operation}). Nothing was written. Check that PostgreSQL is running and that DB_HOST/DB_PORT in .env point at it, then try again. Details: ${detail}`);
  }
}

/**
 * Aggregates all ERP domain data from PostgreSQL. Falls back to the
 * read-only db.json snapshot only when the database cannot be reached at
 * all, and says so loudly when it does.
 *
 * With a `scope`, the farm-specific collections (cattle, weights, sales,
 * health logs, batches) are filtered inside PostgreSQL so other farms' rows are
 * never loaded. The db.json fallback is not scoped here; callers still run
 * scopeDataForActor over the result.
 */
export async function getDbData(scope?: FarmScope): Promise<ERPLivestockData> {
  try {
    const [stock, weightTracking, salesTracking, batches, healthLogs, settings, feedProducts, feedTransactions, proposalPlans] = await Promise.all([
      stockService.getAllStock(scope),
      weightService.getAllWeightRecords(scope),
      salesService.getAllSales(scope),
      batchService.getAllBatches(scope),
      healthService.getAllHealthLogs(scope),
      settingsService.getSettings(),
      feedRepository.getProducts().catch(() => []),
      feedRepository.getTransactions().catch(() => []),
      proposalPlanRepository.findAll().catch(() => [])
    ]);

    const common = {
      breeds: settings.breeds || [],
      healthStatuses: settings.healthStatuses || [],
      statuses: ['Active', 'Sold', 'Transferred', 'Quarantined'],
      buyTypes: settings.buyTypes || [],
      sexes: settings.sexes || []
    };

    // Everything below comes from PostgreSQL and nowhere else. db.json is
    // deliberately not merged in here: a record that is missing from the
    // database should read as missing, not be quietly topped up from a file,
    // which is what used to hide the difference between the two.
    const erpData: ERPLivestockData = {
      stock,
      weightTracking,
      salesTracking,
      common,
      batches,
      healthLogs,
      settings,
      feedProducts: feedProducts || [],
      feedTransactions: feedTransactions || [],
      proposalPlans
    };

    // Reads must not write. Feed only leaves stock when a farm or the office
    // records the day (src/services/daily-feed.service.ts); nothing is automatic.

    return erpData;
  } catch (err) {
    console.error('[getDbData] PostgreSQL is unreachable:', err);
    console.error('[getDbData] Serving the READ-ONLY db.json snapshot instead. This data may be out of date, and saving anything will fail until the database is back.');
    return getJsonDbData();
  }
}

// ─── Feed ───────────────────────────────────────────────────────────────────
export async function saveFeedProduct(product: FeedProductItem): Promise<FeedProductItem> {
  await requireDb('save feed product', () => feedRepository.saveProduct(product));
  return product;
}

export async function deleteFeedProduct(productId: string): Promise<void> {
  await requireDb('delete feed product', () => feedRepository.deleteProduct(productId));
}

export async function addFeedTransaction(tx: FeedStockTransaction): Promise<FeedStockTransaction> {
  await requireDb('add feed transaction', () => feedRepository.addTransaction(tx));
  return tx;
}

// ─── Proposal / Plan ────────────────────────────────────────────────────────
export async function saveProposalPlan(slot: number, name: string, params: ProposalPlanParams, updatedBy?: string): Promise<ProposalPlanRecord> {
  return requireDb('save proposal plan', () => proposalPlanService.savePlan(slot, name, params, updatedBy));
}

export async function deleteProposalPlan(slot: number): Promise<boolean> {
  return requireDb('delete proposal plan', () => proposalPlanService.deletePlan(slot));
}

// ─── 1. Stock / Inventory ───────────────────────────────────────────────────
export async function addStockItem(item: Omit<StockItem, 'no'>): Promise<StockItem> {
  return requireDb('add cattle record', () => stockService.createStock(item));
}

export async function updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem> {
  return requireDb('update cattle record', () => stockService.updateStock(id, updates));
}

export async function deleteStockItem(cowId: string): Promise<void> {
  await requireDb('delete cattle record', () => stockService.deleteStock(cowId));
}

// ─── 2. Weight Tracking ─────────────────────────────────────────────────────
export async function addWeightRecord(cowId: string, currentWeight: number, healthStatus: string, trackingDate?: string): Promise<WeightRecord> {
  return requireDb('record weight', () => weightService.addWeightRecord(cowId, currentWeight, healthStatus, trackingDate));
}

export async function updateWeightRecord(cowId: string, trackingDate: string, currentWeight: number, healthStatus: string): Promise<void> {
  await requireDb('update weight record', () => weightService.updateWeightRecord(cowId, trackingDate, currentWeight, healthStatus));
}

export async function deleteWeightRecord(cowId: string, trackingDate: string): Promise<void> {
  await requireDb('delete weight record', () => weightService.deleteWeightRecord(cowId, trackingDate));
}

// ─── 3. Sales Tracking ──────────────────────────────────────────────────────
export async function recordSale(cowId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string, buyer?: string): Promise<SalesRecord> {
  return requireDb('record sale', () => salesService.recordSale(cowId, unitPrice, saleType, salesDate, buyer));
}

export async function recordBatchSale(batchId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string): Promise<SalesRecord[]> {
  return requireDb('record batch sale', () => salesService.recordBatchSale(batchId, unitPrice, saleType, salesDate));
}

export async function updateSalesRecord(cowId: string, updates: Partial<SalesRecord>): Promise<SalesRecord> {
  return requireDb('update sales record', () => salesService.updateSalesRecord(cowId, updates));
}

export async function deleteSalesRecord(cowId: string): Promise<void> {
  await requireDb('delete sales record', () => salesService.deleteSalesRecord(cowId));
}

// ─── 4. Batch Management ────────────────────────────────────────────────────
export async function createBatch(batch: Omit<BatchItem, 'cowIds'>): Promise<BatchItem> {
  return requireDb('create batch', () => batchService.createBatch(batch));
}

export async function updateBatch(batchId: string, updates: Partial<BatchItem>): Promise<BatchItem> {
  return requireDb('update batch', () => batchService.updateBatch(batchId, updates));
}

export async function assignCowsToBatch(batchId: string, cowIds: string[]): Promise<BatchItem> {
  return requireDb('assign cattle to batch', () => batchService.assignCowsToBatch(batchId, cowIds));
}

export async function removeCowFromBatch(batchId: string, cowId: string): Promise<BatchItem> {
  return requireDb('remove cattle from batch', () => batchService.removeCowFromBatch(batchId, cowId));
}

export async function recordBatchWeights(records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]): Promise<void> {
  await requireDb('record batch weights', () => batchService.recordBatchWeights(records));
}

export async function recordBatchHealthLog(batchId: string, log: Omit<HealthLogItem, 'id' | 'cowId'>): Promise<HealthLogItem[]> {
  return requireDb('record batch health log', () => batchService.recordBatchHealthLog(batchId, log));
}

export async function deleteBatch(batchId: string): Promise<void> {
  await requireDb('delete batch', () => batchService.deleteBatch(batchId));
}

// ─── 5. Health Logs ─────────────────────────────────────────────────────────
export async function addHealthLog(log: Omit<HealthLogItem, 'id'>): Promise<HealthLogItem> {
  return requireDb('add health log', () => healthService.addHealthLog(log));
}

export async function updateHealthLog(logId: string, updates: Partial<HealthLogItem>): Promise<HealthLogItem> {
  return requireDb('update health log', () => healthService.updateHealthLog(logId, updates));
}

export async function deleteHealthLog(logId: string): Promise<void> {
  await requireDb('delete health log', () => healthService.deleteHealthLog(logId));
}


// ─── 7. Master Setup / Settings ─────────────────────────────────────────────
export async function updateSettings(settings: Partial<MasterSetup>, actor: Actor): Promise<MasterSetup> {
  return requireDb('save settings', () => settingsService.updateSettings(settings, actor));
}

// People and farms: one account or one farm at a time (see user-admin.service and farm.service).
export async function createUser(actor: Actor, input: PersonInput) {
  return requireDb('add person', () => userAdminService.createUser(actor, input));
}
export async function updateUser(actor: Actor, id: string, input: PersonInput) {
  return requireDb('change person', () => userAdminService.updateUser(actor, id, input));
}
export async function setUserStatus(actor: Actor, id: string, status: 'Active' | 'Inactive') {
  return requireDb('turn person on or off', () => userAdminService.setStatus(actor, id, status));
}
export async function resetUserPassword(actor: Actor, id: string) {
  return requireDb('reset password', () => userAdminService.resetPassword(actor, id));
}
export async function deleteUser(actor: Actor, id: string) {
  return requireDb('remove person', () => userAdminService.deleteUser(actor, id));
}
export async function saveFarm(actor: Actor, input: FarmInput, farmId: string | null) {
  return requireDb('save farm', () => farmService.saveFarm(actor, input, farmId));
}
export async function deleteFarm(actor: Actor, farmId: string) {
  return requireDb('delete farm', () => farmService.deleteFarm(actor, farmId));
}
export async function setFarmOwner(actor: Actor, farmId: string, userId: string) {
  return requireDb('choose farm owner', () => farmService.setOwner(actor, farmId, userId));
}
