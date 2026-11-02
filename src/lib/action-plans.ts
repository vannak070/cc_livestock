/**
 * Contracts and the buy-back schedule (migration 024). Browser-safe: the server and the Action plans
 * screens use the same rules. The old free-text 3-day plans were retired on 2026-10-15; the work is
 * now planned by farm programs and tasks (src/lib/ops-program.ts).
 *
 * Defaults chosen 2026-10-14 until Management decides: one contract per batch; the buy-back price is a
 * fixed riel price per kg. A batch's contract price overrides the farm's plan price (buybackSchedule).
 * Super Admin/Admin write; Management reads. There is no approval step
 * (user, 2026-10-14: "management just need to see the report based on action plan").
 */
import type { StockItem } from './xlsx-parser';
import type { BatchItem } from '../types/batch.types';
import { isDay } from './daily-feed';

// ─── Who may do what ─────────────────────────────────────────────────────────

type Person = { role?: string } | null | undefined;
const roleIn = (u: Person, roles: string[]) => !!u?.role && roles.includes(u.role);

/** Who may open the Action plans page (it shows contract prices, so not farm accounts). */
export const canSeeActionPlans = (u: Person) => roleIn(u, ['Super Admin', 'Admin', 'Management']);
/** Who writes plans and contracts (Management only reads them). */
export const canWritePlans = (u: Person) => roleIn(u, ['Super Admin', 'Admin']);

// ─── Contracts and the buy-back schedule ─────────────────────────────────────

export interface BatchContract {
  batchId: string;
  contractNo: string;
  /** Riel CamCow pays the farm for each kg at buy-back. */
  buybackPricePerKg?: number;
  /** The day the cattle were delivered to the farm (YYYY-MM-DD). */
  deliveredOn?: string;
  notes: string;
  updatedBy: string;
  updatedAt: string;
}

export type ContractInput = Pick<BatchContract, 'contractNo' | 'buybackPricePerKg' | 'deliveredOn' | 'notes'>;

/** What is wrong with a contract, or null. */
export function contractProblem(c: ContractInput): string | null {
  if ((c.contractNo ?? '').trim().length > 50) return 'Keep the contract number to 50 characters.';
  const price = c.buybackPricePerKg;
  if (price !== undefined && price !== null && !(Number.isFinite(price) && price > 0 && price <= 1_000_000)) return 'Enter the price per kg for the finished cattle in riel (more than 0).';
  if (c.deliveredOn && !isDay(c.deliveredOn)) return 'Choose the delivery date.';
  if ((c.notes ?? '').length > 1000) return 'Keep the notes to 1,000 characters.';
  return null;
}

/** How soon a buy-back is due. */
export type DueBucket = 'overdue' | 'd7' | 'd30' | 'd60' | 'later' | 'noDate';
export const DUE_BUCKETS: DueBucket[] = ['overdue', 'd7', 'd30', 'd60', 'later', 'noDate'];

export interface BuybackRow {
  batchId: string;
  batchName: string;
  farm: string;
  contractNo: string;
  /** The batch's selling target date (YYYY-MM-DD). */
  dueDate?: string;
  /** Days until it is due; negative when overdue. */
  daysLeft?: number;
  bucket: DueBucket;
  /** Animals of the batch still on the farm. */
  head: number;
  /** Their latest weights added together. */
  estKg: number;
  /** The contract's price, or the batch's hoped-for price when there is no contract price. */
  pricePerKg?: number;
  /** Where the price comes from: the batch's contract, the price set on the batch itself, or (when neither exists) the farm's plan. */
  priceSource?: 'contract' | 'plan' | 'batch';
  /** True when the price is the farm plan's general price, not one set for this batch (contract or batch price). */
  priceIsEstimate: boolean;
  /** estKg × pricePerKg, when there is a price. */
  value?: number;
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

export function dueBucket(daysLeft: number | undefined): DueBucket {
  if (daysLeft === undefined) return 'noDate';
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 7) return 'd7';
  if (daysLeft <= 30) return 'd30';
  if (daysLeft <= 60) return 'd60';
  return 'later';
}

const isActive = (status?: string) => (status ?? '').toLowerCase() === 'active';

/**
 * Every active batch with cattle still on the farm, soonest buy-back first (no date last). The price per kg is the
 * batch's contract price, else the price set on the batch itself, else the farm's plan price (`farmPrices`, see ops-view
 * `planPricesByFarm`) for batches that have none.
 */
export function buybackSchedule(batches: BatchItem[], stock: StockItem[], contracts: BatchContract[], today: string, farmPrices?: ReadonlyMap<string, number>): BuybackRow[] {
  const byId = new Map(stock.map(c => [c.id, c]));
  const contractOf = new Map(contracts.map(c => [c.batchId, c]));
  const rows: BuybackRow[] = [];
  for (const b of batches) {
    if (b.status !== 'Active') continue;
    const cattle = (b.cowIds ?? []).map(id => byId.get(id)).filter((c): c is StockItem => !!c && isActive(c.status));
    if (cattle.length === 0) continue;
    const contract = contractOf.get(b.id);
    const dueDate = b.sellingTargetDate && isDay(b.sellingTargetDate.slice(0, 10)) ? b.sellingTargetDate.slice(0, 10) : undefined;
    const daysLeft = dueDate ? Math.round(dayNumber(dueDate) - dayNumber(today)) : undefined;
    const estKg = Math.round(cattle.reduce((s, c) => s + (Number(c.weight) || 0), 0));
    const farm = b.farmLocation || cattle[0].location || '';
    const planPrice = farmPrices?.get(farm);
    const priceSource: BuybackRow['priceSource'] = contract?.buybackPricePerKg ? 'contract' : b.expectedSellingPrice ? 'batch' : planPrice ? 'plan' : undefined;
    const pricePerKg = priceSource === 'contract' ? contract!.buybackPricePerKg : priceSource === 'batch' ? b.expectedSellingPrice || undefined : planPrice;
    rows.push({
      batchId: b.id,
      batchName: b.name,
      farm,
      contractNo: contract?.contractNo ?? '',
      dueDate,
      daysLeft,
      bucket: dueBucket(daysLeft),
      head: cattle.length,
      estKg,
      pricePerKg: pricePerKg || undefined,
      priceSource,
      priceIsEstimate: priceSource === 'plan',
      value: pricePerKg ? Math.round(estKg * pricePerKg) : undefined,
    });
  }
  return rows.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.batchName.localeCompare(b.batchName));
}
