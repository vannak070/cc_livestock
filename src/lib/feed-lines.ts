import type { PlanFeedLine, ProposalPlanParams } from './types';

/**
 * Feed in the plans (fattening plans and farm loans), by kind: how many kg each
 * animal eats a day and what a kg costs. Feed grown on the farm gets an
 * estimated cost so it still shows in the plan's costs.
 */

export const MAX_FEED_LINES = 20;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Riel per animal a day for one feed. */
export const lineCostPerHeadDay = (l: Pick<PlanFeedLine, 'kgPerHeadDay' | 'pricePerKgKhr'>) => l.kgPerHeadDay * l.pricePerKgKhr;

/** Riel and kg per animal a day for all the feeds together. */
export function feedPerHeadDay(lines: PlanFeedLine[]): { kg: number; costKhr: number } {
  return {
    kg: round1(lines.reduce((s, l) => s + l.kgPerHeadDay, 0)),
    costKhr: Math.round(lines.reduce((s, l) => s + lineCostPerHeadDay(l), 0)),
  };
}

/** What each feed comes to for a number of animal-days (head × days). */
export function feedNeeds(lines: PlanFeedLine[], headDays: number): { name: string; kg: number; costKhr: number }[] {
  return lines.map(l => ({ name: l.name, kg: Math.round(l.kgPerHeadDay * headDays), costKhr: Math.round(lineCostPerHeadDay(l) * headDays) }));
}

/** A fattening plan's feed lines; older plans only have grass and concentrate. */
export function planFeedLines(p: ProposalPlanParams): PlanFeedLine[] {
  if (p.feedLines && p.feedLines.length > 0) return p.feedLines;
  return [
    { name: 'Grass', kgPerHeadDay: p.grassKgPerHeadDay, pricePerKgKhr: p.grassCostPerKgKhr },
    { name: 'Concentrate', kgPerHeadDay: p.concentrateKgPerHeadDay, pricePerKgKhr: p.concentrateCostPerKgKhr },
  ];
}

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** Feed lines from untrusted input: [] when missing, or an error message. */
export function parseFeedLines(raw: unknown): PlanFeedLine[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return 'The feed list is not valid.';
  if (raw.length > MAX_FEED_LINES) return `Keep it to ${MAX_FEED_LINES} feeds or fewer.`;
  const out: PlanFeedLine[] = [];
  for (const x of raw as Record<string, unknown>[]) {
    const name = typeof x?.name === 'string' ? x.name.trim() : '';
    if (!name || name.length > 80) return 'Each feed needs a name (up to 80 letters).';
    const kg = num(x.kgPerHeadDay, 0, 200);
    if (kg === null) return `Type the kg each animal eats of ${name} a day (0 to 200).`;
    const price = num(x.pricePerKgKhr, 0, 1_000_000);
    if (price === null) return `Type the price of a kg of ${name} (0 or more).`;
    const productId = typeof x.productId === 'string' && x.productId.trim() ? x.productId.trim().slice(0, 100) : undefined;
    out.push({ ...(productId ? { productId } : {}), name, kgPerHeadDay: kg, pricePerKgKhr: price });
  }
  return out;
}
