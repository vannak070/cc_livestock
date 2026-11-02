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
import { StockItem, SalesRecord } from '@/lib/xlsx-parser';
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
import { isDataPart, partsToRead, pickParts } from '@/lib/data-parts';
import { scopeFor } from '@/lib/farm-scope';
import { farmGuard } from '@/lib/farm-guard';
import { assertPlanningAccess } from '@/lib/authz';
import { feedProductService } from '@/services/feed-product.service';
import { saleReviewService } from '@/services/sale-review.service';
import { telegramService } from '@/services/telegram.service';
import { alertSettings, escapeHtml } from '@/lib/alerts';
import { settingsRepository } from '@/repositories/settings.repository';
import type { SaleReviewInput } from '@/lib/sale-review';
import { farmLimitService } from '@/services/farm-limit.service';
import { followUpService } from '@/services/follow-up.service';
import { billingService } from '@/services/billing.service';
import { sessionService } from '@/services/session.service';
import { stockService } from '@/services/stock.service';
import { myAccountService } from '@/services/my-account.service';
import { receiptImportService } from '@/services/receipt-import.service';
import type { ReceiptFile, RegisterInput } from '@/lib/receipt-import';
import { actionPlanService } from '@/services/action-plan.service';
import { opsProgramService, type ProgramSetup } from '@/services/ops-program.service';
import { camcowStockService } from '@/services/camcow-stock.service';
import type { SaleInput as CamcowSaleInput } from '@/lib/camcow-stock';
import type { CostInput as CamcowCostInput } from '@/lib/camcow-costs';
import type { BuyerInput as CamcowBuyerInput } from '@/lib/camcow-buyers';
import type { ProgramStatus } from '@/repositories/ops-program.repository';
import type { TaskChange } from '@/lib/ops-program';
import { lowFeedAlertService } from '@/services/low-feed-alert.service';
import { dailyAlertService } from '@/services/daily-alert.service';
import type { BillingSettings } from '@/lib/types';
import type { ContractInput } from '@/lib/action-plans';
import type { FollowUpInput } from '@/lib/long-stay';
import type { LimitRequestInput } from '@/lib/farm-limit';

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

/** Only the named pieces of the data, scoped like the full load: what a save refreshes instead of everything. */
export async function getLivestockPartsAction(parts: string[]) {
  return runAction('Failed to fetch livestock data', [], async actor => {
    const wanted = (Array.isArray(parts) ? parts : []).filter(isDataPart);
    return pickParts(scopeDataForActor(await getDbData(scopeFor(actor), partsToRead(wanted, !!actor.farmLocation)), actor), wanted);
  }, { revalidate: false });
}

// ─── Stock ──────────────────────────────────────────────────────────────────
export async function addStockItemAction(item: Omit<StockItem, 'no'>) {
  return runAction('Failed to add stock item', ['stock_create'], async actor => {
    farmGuard.requireLocation(actor, item.location);
    return addStockItem(item, actor.name);
  });
}

/** The photo of one animal, loaded when its page opens (the cattle list only says whether there is one). */
export async function getCattlePhotoAction(cowId: string) {
  return runAction('Failed to load the photo', ['stock_view'], async actor => {
    await farmGuard.cows(actor, [cowId]);
    return stockService.getPhoto(cowId);
  }, { revalidate: false });
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
    return deleteStockItem(cowId, actor);
  });
}

// A supplier's receipt (PDF or photo): read by the AI, checked by the person, then every animal registered at once.
export async function readReceiptAction(file: { mediaType: string; base64: string }) {
  return runAction('Could not read the receipt', ['stock_create'], actor => receiptImportService.read(actor, file), { revalidate: false });
}

export async function registerReceiptAction(input: RegisterInput, options: { file?: ReceiptFile | null; confirmedDifferent?: boolean } = {}) {
  return runAction('Failed to register the cattle', ['stock_create'], async actor => {
    farmGuard.requireLocation(actor, input.farm);
    return receiptImportService.register(actor, input, options);
  });
}

/** Was this receipt registered before? (Shown on the check page; register checks again.) */
export async function checkReceiptDuplicateAction(input: Pick<RegisterInput, 'invoiceNo' | 'seller' | 'date' | 'rows'>) {
  return runAction('Could not check the receipt', ['stock_create'], actor => receiptImportService.check(actor, input), { revalidate: false });
}

/** The receipt an animal was registered from (admins only). */
export async function getCattleReceiptAction(cowId: string) {
  return runAction('Could not load the receipt', ['stock_view'], actor => receiptImportService.receiptOfCow(actor, cowId), { revalidate: false });
}

/** The kept original receipt file (admins only). */
export async function getReceiptFileAction(id: string) {
  return runAction('Could not load the receipt file', ['stock_view'], actor => receiptImportService.file(actor, id), { revalidate: false });
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

export async function recordBatchSaleAction(batchId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', salesDate?: string, buyer?: string) {
  return runAction('Failed to record batch sale', ['sales_record'], async actor => {
    await farmGuard.batch(actor, batchId);
    return recordBatchSale(batchId, unitPrice, saleType, salesDate, buyer);
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

// ─── Farm cattle limits ─────────────────────────────────────────────────────
// Who may ask and who may answer is checked in the service (farm accounts for their own farm; Super Admin and Admin answer).
export async function requestFarmLimitAction(input: LimitRequestInput) {
  return runAction('Failed to send the request', [], actor => farmLimitService.request(actor, input));
}

export async function decideFarmLimitAction(id: string, approve: boolean, newLimit: number, note: string) {
  return runAction('Failed to answer the request', [], actor => farmLimitService.decide(actor, id, approve, newLimit, note));
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
  return runAction('Failed to save the person', [], async actor => {
    const saved = await updateUser(actor, id, input);
    // A new password ends older sign-ins; keep the person who just changed their own signed in here.
    if (id === actor.id && input.password?.trim()) await startSession(actor);
    return saved;
  });
}
export async function setUserStatusAction(id: string, status: 'Active' | 'Inactive') {
  return runAction('Failed to change the person', [], actor => setUserStatus(actor, id, status));
}
export async function resetUserPasswordAction(id: string) {
  return runAction('Failed to make a new password', [], actor => resetUserPassword(actor, id));
}
/** My account (side menu -> your name): any signed-in person changes their own name. */
export async function updateMyNameAction(name: string) {
  return runAction('Failed to save your name', [], actor => myAccountService.rename(actor, name));
}
/** My account: any signed-in person changes their own password (the current one is checked; 5 wrong tries -> wait). */
export async function changeMyPasswordAction(input: { current: string; next: string; repeat: string }) {
  return runAction('Failed to change your password', [], async actor => {
    await myAccountService.changePassword(actor, input);
    // Other phones and browsers are signed out by the new password; this one gets a fresh sign-in.
    await startSession(actor);
  }, { revalidate: false });
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

// ─── Telegram alerts ────────────────────────────────────────────────────────
// Only people who manage settings; the bot token never leaves the server.
export async function telegramStatusAction() {
  return runAction('Failed to check Telegram', ['settings_manage'], async () => {
    if (!telegramService.isConfigured()) return { configured: false as const };
    try {
      return { configured: true as const, bot: await telegramService.bot() };
    } catch (err) {
      return { configured: true as const, error: err instanceof Error ? err.message : 'Telegram could not be reached.' };
    }
  }, { revalidate: false });
}

export async function findTelegramChatsAction() {
  return runAction('Failed to look for Telegram groups', ['settings_manage'], () => telegramService.chats(), { revalidate: false });
}

export async function sendTelegramTestAction() {
  return runAction('Failed to send the test message', ['settings_manage'], async actor => {
    const { chatId } = alertSettings(await settingsRepository.getSettings());
    if (!chatId) throw new Error('Choose and save the Telegram group first.');
    await telegramService.send(chatId, `✅ <b>CC Livestock</b>\nThis is a test message, sent by ${escapeHtml(actor.name)}. Alerts are connected.`);
    return { sent: true as const };
  }, { revalidate: false });
}

// Checks for alerts right now, ignoring the send hour. Anything already sent is not sent again.
export async function runSaleAlertsAction() {
  return runAction('Failed to check for alerts', ['settings_manage'], async () => {
    // The per-farm messages (daily check, selling reminder, long stay), then low feed; each has its own count.
    const daily = await dailyAlertService.run({ force: true });
    const lowFeed = await lowFeedAlertService.run({ force: true });
    return { dailySent: daily.sent, lowFeedSent: lowFeed.sent };
  }, { revalidate: true });
}

// ─── Long-stay cattle: next actions ─────────────────────────────────────────
export async function recordFollowUpAction(cowId: string, input: FollowUpInput) {
  return runAction('Failed to save the next action', ['batch_review'], actor => followUpService.record(actor, cowId, input));
}

export async function finishFollowUpAction(id: string) {
  return runAction('Failed to mark the next action done', ['batch_review'], actor => followUpService.finish(actor, id));
}

// ─── Billing for cattle registrations (Super Admin and Admin only) ──────────
export async function getBillingAction(month?: string) {
  return runAction('Failed to load the billing', [], actor => billingService.view(actor, month), { revalidate: false });
}

export async function saveBillingPricesAction(billing: BillingSettings) {
  return runAction('Failed to save the price', [], actor => billingService.savePrices(actor, billing));
}

/** Settings → Sign-in: minutes without activity before sign-out (Super Admin only, src/lib/session-policy.ts). */
export async function saveSessionPolicyAction(idleMinutes: number) {
  return runAction('Failed to save the sign-in time limit', [], actor => sessionService.savePolicy(actor, { idleMinutes }));
}

// ─── Contracts and farm action plans (Super Admin/Admin write, Management reads) ──
// The service checks the role; nothing here changes the herd, so the main data is not reloaded.
// The batch contracts and the month for the Management report; `day` is a month (YYYY-MM) or a day, nothing means this month.
export async function getActionPlansAction(day?: string) {
  return runAction('Failed to load the action plans', [], actor => actionPlanService.view(actor, day), { revalidate: false });
}

export async function saveBatchContractAction(batchId: string, contract: ContractInput) {
  return runAction('Failed to save the contract', [], actor => actionPlanService.saveContract(actor, batchId, contract), { revalidate: false });
}

// ─── Farm programs and operations tasks (Super Admin/Admin write, Management reads) ──
// A program links a farm to one Planning plan; its tasks (sell to the farm, buy back, DSR-16 feed) are what operations
// works and Management watches. The service checks the role; the herd is not changed here, so the main data is not reloaded.
export async function getOpsProgramsAction() {
  return runAction('Failed to load the farm programs', [], actor => opsProgramService.view(actor), { revalidate: false });
}

/** A Farm Owner's own farm program and tasks, for their money statement (the server checks the role and the farm). */
export async function getMyFarmMoneyAction() {
  return runAction('Failed to load the money statement', [], actor => opsProgramService.ownerView(actor), { revalidate: false });
}

export async function createFarmProgramAction(setup: ProgramSetup) {
  return runAction('Failed to set up the farm program', [], actor => opsProgramService.createProgram(actor, setup), { revalidate: false });
}

export async function refreshFarmProgramAction(programId: string, change: Partial<Omit<ProgramSetup, 'farm'>>) {
  return runAction('Failed to refresh the farm program', [], actor => opsProgramService.refreshProgram(actor, programId, change), { revalidate: false });
}

export async function setFarmProgramStatusAction(programId: string, status: ProgramStatus) {
  return runAction('Failed to change the farm program', [], actor => opsProgramService.setProgramStatus(actor, programId, status), { revalidate: false });
}

export async function changeOpsTaskAction(taskId: string, change: TaskChange) {
  return runAction('Failed to save the task', [], actor => opsProgramService.changeTask(actor, taskId, change), { revalidate: false });
}

// ─── CamCow's own stock: cattle collected from farms, held, then sold on (Super Admin and Admin write; Management reads) ───
export async function getCamcowStockAction() {
  return runAction('Failed to load the CamCow stock', [], actor => camcowStockService.view(actor), { revalidate: false });
}

export async function receiveCamcowCattleAction(cowIds: string[]) {
  return runAction('Failed to receive the cattle', [], actor => camcowStockService.receive(actor, cowIds), { revalidate: false });
}

export async function sellCamcowCattleAction(input: CamcowSaleInput) {
  return runAction('Failed to record the sale', [], actor => camcowStockService.sell(actor, input), { revalidate: false });
}

export async function saveCamcowBuyerAction(input: CamcowBuyerInput) {
  return runAction('Failed to save the buyer', [], actor => camcowStockService.saveBuyer(actor, input), { revalidate: false });
}

export async function addCamcowCostAction(input: CamcowCostInput) {
  return runAction('Failed to record the cost', [], actor => camcowStockService.addCost(actor, input), { revalidate: false });
}

export async function deleteCamcowCostAction(id: string) {
  return runAction('Failed to remove the cost', [], actor => camcowStockService.deleteCost(actor, id), { revalidate: false });
}

export async function markCamcowCattleLostAction(cowIds: string[], date: string, note: string) {
  return runAction('Failed to mark the cattle as lost', [], actor => camcowStockService.markLost(actor, cowIds, date, note), { revalidate: false });
}
