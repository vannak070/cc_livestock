import type { ERPLivestockData } from './types';

/**
 * The separately loaded pieces of the app's data. After a save only the pieces it changed are loaded again
 * (getLivestockPartsAction), instead of the whole database.
 */
export const DATA_PARTS = [
  'stock', 'weightTracking', 'salesTracking', 'batches', 'healthLogs', 'settings',
  'feedProducts', 'feedTransactions', 'proposalPlans', 'farmCosts',
  'farmLimitRequests', 'farmLimitChanges', 'cattleFollowUps',
] as const satisfies readonly (keyof ERPLivestockData)[];

export type DataPart = (typeof DATA_PARTS)[number];

export const isDataPart = (v: unknown): v is DataPart => typeof v === 'string' && (DATA_PARTS as readonly string[]).includes(v);

/** Only the requested pieces of a full dataset (unknown names are ignored). */
export function pickParts(data: ERPLivestockData, parts: readonly unknown[]): Partial<ERPLivestockData> {
  const out: Partial<ERPLivestockData> = {};
  for (const part of new Set(parts.filter(isDataPart))) (out as Record<string, unknown>)[part] = data[part];
  // The settings piece also carries the lists derived from it (breeds, health statuses...).
  if (out.settings) out.common = data.common;
  return out;
}

/**
 * What to read from the database for the requested pieces. A farm-bound user's weights, health logs, sales,
 * batches and follow-ups are trimmed by the ids of that farm's cattle (src/lib/farm-view.ts), so the cattle
 * are read too in that case, even though they are not sent back unless asked for.
 */
export function partsToRead(wanted: readonly DataPart[], farmBound: boolean): DataPart[] {
  const needsCattle = ['weightTracking', 'healthLogs', 'salesTracking', 'batches', 'cattleFollowUps'].some(p => wanted.includes(p as DataPart));
  return farmBound && needsCattle && !wanted.includes('stock') ? [...wanted, 'stock'] : [...wanted];
}
