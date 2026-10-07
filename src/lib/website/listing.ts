import type { Availability, BatchItem, WebsiteBatchListing } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { batchCattle, sexOf } from '../batch-stats';
import { sickCattle } from '../attention';
import { addDays } from '../daily-feed';
import { headCountLabel, weightClass, type HeadCount, type WeightClass } from './rounding';

/**
 * What a batch offered on the website shows (SFD section 5): breed, sex,
 * weight class, rounded head count and "now" or "soon". Exact weights,
 * counts and dates stay inside CC Livestock.
 */
export const SOON_DAYS = 60;

/** Healthy active animals of the batch: sick animals are never counted or shown. */
export function healthyBatchCattle(batch: Pick<BatchItem, 'cowIds'>, stock: StockItem[]): StockItem[] {
  const cattle = batchCattle(batch, stock);
  const sick = new Set(sickCattle(cattle).map(c => c.id));
  return cattle.filter(c => !sick.has(c.id));
}

/** Each animal's latest recorded weight, else its weight on arrival. */
export function currentWeights(cattle: StockItem[], weights: WeightRecord[]): number[] {
  const latest = new Map<string, { day: string; kg: number }>();
  for (const w of weights) {
    const day = (w.trackingDate ?? '').slice(0, 10);
    const prev = latest.get(w.cowId);
    if (!prev || day > prev.day) latest.set(w.cowId, { day, kg: Number(w.currentWeight) || 0 });
  }
  return cattle.map(c => latest.get(c.id)?.kg ?? (Number(c.weight) || 0)).filter(kg => kg > 0);
}

/**
 * "now": marked Ready to sell, or within the sale review window (or late);
 * "soon": within 60 days; anything later, or no selling date: not listed.
 * The office can set it by hand (override).
 */
export function availabilityOf(
  batch: Pick<BatchItem, 'sellingTargetDate' | 'saleReview'>,
  override: Availability | undefined,
  today: string,
  saleWindow: number
): Availability | null {
  if (override) return override;
  if (batch.saleReview?.decision === 'ready') return 'now';
  const target = (batch.sellingTargetDate ?? '').slice(0, 10);
  if (!target) return null;
  if (target <= addDays(today, saleWindow)) return 'now';
  if (target <= addDays(today, SOON_DAYS)) return 'soon';
  return null;
}

const mostCommon = (values: string[]): string => {
  const n = new Map<string, number>();
  for (const v of values.map(x => x.trim()).filter(Boolean)) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
};

export type PublicSex = 'Male' | 'Female' | 'Male and female';

export function sexLabel(cattle: StockItem[]): PublicSex | '' {
  const males = cattle.filter(c => sexOf(c.sex) === 'male').length;
  const females = cattle.filter(c => sexOf(c.sex) === 'female').length;
  if (males > 0 && females > 0) return 'Male and female';
  if (males > 0) return 'Male';
  if (females > 0) return 'Female';
  return '';
}

export interface ListingFacts {
  breed: string;
  sex: string;
  weightClass: WeightClass | null;
  headCount: HeadCount | null;
  availability: Availability | null;
  /** Healthy animals; 0 means the batch cannot be listed. */
  healthyHead: number;
}

export function listingFacts(
  batch: BatchItem,
  listing: Pick<WebsiteBatchListing, 'publicBreed' | 'publicSex' | 'overrideAvailability'> | undefined,
  stock: StockItem[],
  weights: WeightRecord[],
  today: string,
  saleWindow: number
): ListingFacts {
  const cattle = healthyBatchCattle(batch, stock);
  const kg = currentWeights(cattle, weights);
  const avg = kg.length ? kg.reduce((s, x) => s + x, 0) / kg.length : 0;
  return {
    breed: listing?.publicBreed?.trim() || mostCommon(cattle.map(c => c.breed)),
    sex: listing?.publicSex?.trim() || sexLabel(cattle),
    weightClass: kg.length ? weightClass(avg) : null,
    headCount: cattle.length ? headCountLabel(cattle.length) : null,
    availability: availabilityOf(batch, listing?.overrideAvailability, today, saleWindow),
    healthyHead: cattle.length,
  };
}

/** Why a batch cannot be shown on the website, or null when it can. */
export function listingProblem(batch: Pick<BatchItem, 'status' | 'farmLocation'>, farmPublished: boolean, healthyHead: number): string | null {
  if (batch.status !== 'Active') return 'Only an active batch can be shown on the website.';
  if (!farmPublished) return "The batch's farm is not on the website yet. Publish the farm's profile first.";
  if (healthyHead === 0) return 'The batch has no healthy animals to show.';
  return null;
}
