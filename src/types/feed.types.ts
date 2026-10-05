export type FeedTransactionType = 'STOCK_IN' | 'STOCK_OUT';

export interface FeedProductItem {
  id: string;
  name: string;
  category: string; // e.g. 'Concentrate', 'Silage', 'Roughage', 'Supplement'
  unit: string; // e.g. 'bag', 'kg', 'ton'
  weightPerUnit: number; // e.g. 30 (kg per bag)
  unitCost: number; // e.g. 2000 (៛ per kg)
  costType?: 'per_bag' | 'per_kg'; // Cost entry unit preference
  costPerBag?: number; // e.g. 60000 (៛ per bag)
  minThresholdBags: number; // Default 50 bags
  minThresholdKg: number; // Default 1500 kg (50 bags * 30 kg)
  description?: string;
  supplier?: string;
  status: 'Active' | 'Inactive';
  /** False for feed grown or cut on the farm: its daily use is recorded, but it is not kept as stock. */
  trackStock?: boolean;
  createdAt?: string;
}

export interface FeedStockTransaction {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: FeedTransactionType;
  quantityBags: number;
  quantityKg: number;
  unitCost: number;
  totalCost: number;
  sourceFarm?: string; // Source farm location or supplier
  targetFarm?: string; // Target farm location for transfers or stock-in
  referenceNo?: string;
  recordedBy?: string;
  notes?: string;
  createdAt?: string;
}

export interface FeedBalanceItem {
  id?: string;
  productId: string;
  productName: string;
  farmLocation: string;
  activeBatchName?: string;
  activeBatches?: string[];
  balanceBags: number;
  balanceKg: number;
  unitCost: number;
  totalValuation: number;
  isLowStock: boolean;
  minThresholdBags: number;
  minThresholdKg: number;
}
