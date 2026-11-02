/**
 * The buyers CC Livestock sells its stock on to (user, 2026-10-16). Only who bought what is kept: paid or unpaid is NOT tracked
 * (user, 2026-10-16: "very difficult to track"). Pure and browser-safe (camcow-stock.service.ts writes).
 */
import type { Holding } from './camcow-stock';

export const BUYER_KINDS = ['slaughterhouse', 'trader', 'farm', 'other'] as const;
export type BuyerKind = (typeof BUYER_KINDS)[number];

export interface Buyer { id: string; name: string; kind: BuyerKind; phone: string; location: string; note: string; active: boolean }
export interface BuyerInput { id?: string; name: string; kind: BuyerKind; phone?: string; location?: string; note?: string; active?: boolean }

/** What is wrong with a buyer's details, or null. `others` are the other buyers' names. */
export function buyerProblem(input: BuyerInput, others: string[]): string | null {
  const name = (input.name ?? '').trim();
  if (!name) return 'Write the buyer\'s name.';
  if (name.length > 100) return 'Keep the buyer\'s name under 100 characters.';
  if (others.some(n => n.trim().toLowerCase() === name.toLowerCase())) return 'There is already a buyer with this name.';
  if (!BUYER_KINDS.includes(input.kind)) return 'Choose what kind of buyer this is.';
  if ((input.phone ?? '').length > 50) return 'Keep the phone number under 50 characters.';
  if ((input.location ?? '').length > 150) return 'Keep the place under 150 characters.';
  if ((input.note ?? '').length > 500) return 'Keep the note under 500 characters.';
  return null;
}

/** One day's sale to a buyer. */
export interface BuyerSale { key: string; soldOn: string; head: number; kg: number; total: number; margin: number; cowIds: string[] }

export interface BuyerAccount {
  buyer: Buyer;
  head: number;
  kg: number;
  sold: number;
  /** Average sale price a kg, riel (0 when nothing was sold). */
  perKg: number;
  /** Sale less what CC Livestock paid at the collection. */
  margin: number;
  lastSaleOn?: string;
  /** Newest first. */
  sales: BuyerSale[];
}

/** Each buyer's sales (one per day) and totals. Buyers with nothing sold yet are included. Biggest buyer first. */
export function buyerAccounts(holdings: Holding[], buyers: Buyer[]): BuyerAccount[] {
  return buyers.map(buyer => {
    const days = new Map<string, BuyerSale>();
    for (const h of holdings) {
      if (h.status !== 'Sold' || h.buyerId !== buyer.id) continue;
      const soldOn = h.soldOn ?? '';
      const s = days.get(soldOn) ?? { key: `${buyer.id}|${soldOn}`, soldOn, head: 0, kg: 0, total: 0, margin: 0, cowIds: [] as string[] };
      s.cowIds.push(h.cowId); s.head++; s.kg += h.saleWeight ?? 0; s.total += h.saleTotal ?? 0; s.margin += (h.saleTotal ?? 0) - h.collectionTotal;
      days.set(soldOn, s);
    }
    const sales = [...days.values()].sort((a, b) => b.soldOn.localeCompare(a.soldOn));
    const kg = sales.reduce((s, x) => s + x.kg, 0);
    const sold = sales.reduce((s, x) => s + x.total, 0);
    return {
      buyer,
      head: sales.reduce((s, x) => s + x.head, 0),
      kg,
      sold,
      perKg: kg > 0 ? Math.round(sold / kg) : 0,
      margin: sales.reduce((s, x) => s + x.margin, 0),
      ...(sales.length ? { lastSaleOn: sales[0].soldOn } : {}),
      sales,
    };
  }).sort((a, b) => b.sold - a.sold || a.buyer.name.localeCompare(b.buyer.name));
}

export interface BuyersSummary { buyers: number; active: number; head: number; sold: number; margin: number }

export function summarizeBuyers(accounts: BuyerAccount[]): BuyersSummary {
  return {
    buyers: accounts.length,
    active: accounts.filter(a => a.buyer.active).length,
    head: accounts.reduce((s, a) => s + a.head, 0),
    sold: accounts.reduce((s, a) => s + a.sold, 0),
    margin: accounts.reduce((s, a) => s + a.margin, 0),
  };
}
