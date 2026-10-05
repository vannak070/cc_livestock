/** A farm running cost: wages, power and water, fuel, repairs and so on. */
export interface FarmCostItem {
  id: string;
  farmLocation: string;
  category: string;
  /** Riel. */
  amount: number;
  /** The farm day it was paid, YYYY-MM-DD. */
  date: string;
  note?: string;
  recordedBy?: string;
  createdAt?: string;
}
