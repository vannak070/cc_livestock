export interface FeedIngredientConfig {
  name: string;
  /** The feed product this is taken from; older rations matched by name only. */
  productId?: string;
  portionPerHead: number; // in kg/head/day
  unitCost: number; // in Riel/kg
}

export interface FeedingProgramConfig {
  ingredients: FeedIngredientConfig[];
  frequency: string; // e.g., "Once Daily", "Twice Daily"
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Paused' | 'Completed';
  notes?: string;
}

export interface BatchItem {
  id: string; // Batch Code
  name: string;
  type: string; // Fattening, Breeding, Dairy, Quarantine, Selling
  startDate: string;
  status: 'Active' | 'Closed';
  cowIds: string[]; // List of Cow_IDs in this batch
  notes?: string;
  feedingProgram?: FeedingProgramConfig;
  farmLocation?: string;
  expectedSellingPrice?: number; // ៛ per kg (target price)
  sellingTargetDate?: string; // ISO date (YYYY-MM-DD) — planned sell/harvest date for this batch
}
