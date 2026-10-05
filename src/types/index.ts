import { StockItem, WeightRecord, SalesRecord } from './stock.types';
import { BatchItem } from './batch.types';
import { HealthLogItem } from './health.types';
import { MasterSetup } from './settings.types';
import { FeedProductItem, FeedStockTransaction } from './feed.types';
import { ProposalPlanRecord } from './proposal.types';
import { FarmCostItem } from './cost.types';
import { FarmLoanRecord } from './loan.types';

export * from './stock.types';
export * from './batch.types';
export * from './health.types';
export * from './settings.types';
export * from './feed.types';
export * from './proposal.types';
export * from './cost.types';
export * from './loan.types';

export interface ERPLivestockData {
  stock: StockItem[];
  weightTracking: WeightRecord[];
  salesTracking: SalesRecord[];
  common: Record<string, unknown>; // original reference sheets
  batches: BatchItem[];
  healthLogs: HealthLogItem[];
  settings: MasterSetup;
  feedProducts?: FeedProductItem[];
  feedTransactions?: FeedStockTransaction[];
  proposalPlans?: ProposalPlanRecord[];
  farmCosts?: FarmCostItem[];
  farmLoans?: FarmLoanRecord[];
}
