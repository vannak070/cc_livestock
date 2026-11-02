/**
 * One animal's path through CamCow stock: collected from its farm, received, held, then sold on to a buyer or lost. Pure and browser-safe; the screens read it for the "check one cow" dialog and the cattle list.
 */
import type { Holding } from './camcow-stock';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export interface CowTrail {
  cowId: string;
  farm: string;
  batchId?: string;
  status: Holding['status'];
  collectedOn: string;
  collectionWeight: number;
  collectionTotal: number;
  /** What CC Livestock paid a kg at the collection. */
  collectionPerKg: number;
  /** Days in stock: to the sale or loss, or to today while it is still held. */
  daysHeld: number;
  soldOn?: string;
  buyer?: string;
  buyerId?: string;
  saleWeight?: number;
  salePerKg?: number;
  saleTotal?: number;
  /** Weight gained (or lost) between the collection and the scale at the sale. */
  weightChange?: number;
  /** Sale less collection price; for a lost animal the loss (negative); undefined while held. */
  margin?: number;
  marginPerKg?: number;
  lostOn?: string;
  /** This animal's share of the holding costs over its stay (riel); 0 when no costs were recorded. */
  holdingCost: number;
  /** Margin (or loss) less the holding costs; undefined while held. */
  marginAfterCosts?: number;
  note: string;
}

/** The trail of one animal. */
export function cowTrail(h: Holding, today: string, holdingCost = 0): CowTrail {
  const end = h.status === 'Sold' ? h.soldOn : h.status === 'Lost' ? h.lostOn : today;
  const margin = h.status === 'Sold' ? (h.saleTotal ?? 0) - h.collectionTotal : h.status === 'Lost' ? -h.collectionTotal : undefined;
  return {
    cowId: h.cowId,
    farm: h.sourceFarm,
    ...(h.batchId ? { batchId: h.batchId } : {}),
    status: h.status,
    collectedOn: h.collectedOn,
    collectionWeight: h.collectionWeight,
    collectionTotal: h.collectionTotal,
    collectionPerKg: h.collectionWeight > 0 ? Math.round(h.collectionTotal / h.collectionWeight) : 0,
    daysHeld: Math.max(0, daysBetween(h.collectedOn, end ?? today)),
    ...(h.status === 'Sold' ? {
      soldOn: h.soldOn, buyer: h.buyer, buyerId: h.buyerId, saleWeight: h.saleWeight, salePerKg: h.salePricePerKg, saleTotal: h.saleTotal,
      weightChange: Math.round(((h.saleWeight ?? 0) - h.collectionWeight) * 10) / 10,
      marginPerKg: h.saleWeight ? Math.round((margin ?? 0) / h.saleWeight) : 0,
    } : {}),
    ...(margin !== undefined ? { margin, marginAfterCosts: Math.round(margin - holdingCost) } : {}),
    holdingCost: Math.round(holdingCost),
    ...(h.status === 'Lost' ? { lostOn: h.lostOn } : {}),
    note: h.note,
  };
}

export type CowFilter = 'all' | 'Held' | 'Sold' | 'Lost';

/** The animals to list: by status, a search (tag, farm or buyer) and an optional fixed set of animals. */
export function filterTrails(trails: CowTrail[], f: { status: CowFilter; search: string; only?: Set<string> }): CowTrail[] {
  const q = f.search.trim().toLowerCase();
  return trails.filter(t => {
    if (f.only && !f.only.has(t.cowId)) return false;
    if (f.status !== 'all' && t.status !== f.status) return false;
    return !q || [t.cowId, t.farm, t.buyer ?? ''].some(x => x.toLowerCase().includes(q));
  });
}
