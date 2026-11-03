import type { StockItem } from './xlsx-parser';

/**
 * Correcting an animal's details (user request 2026-11-03: "allow super admin edit on Cattle"). Only a Super Admin, and
 * only the details below. The tag, farm, weight, health and status keep their own flows (moves, weighing, treatment,
 * sale), so their history stays right. Pure: the edit dialog and the server share these rules.
 */
export const EDITABLE_CATTLE_FIELDS = ['breed', 'sex', 'age', 'ownerName', 'phone', 'purchaseDate', 'paymentMethod', 'unitPrice', 'totalPrice', 'remark'] as const;
export type CattleDetails = Pick<StockItem, (typeof EDITABLE_CATTLE_FIELDS)[number]>;

export const canEditCattleDetails = (user: { role?: string } | null | undefined): boolean => user?.role === 'Super Admin';

export type CattleEditProblem = 'sex' | 'date' | 'futureDate' | 'price' | 'tooLong';

/** Only the editable fields, trimmed; anything else sent is dropped. */
export function cleanCattleDetails(input: Partial<Record<string, unknown>>): Partial<CattleDetails> {
  const out: Partial<CattleDetails> = {};
  for (const key of EDITABLE_CATTLE_FIELDS) {
    const v = input[key];
    if (v === undefined) continue;
    if (key === 'unitPrice' || key === 'totalPrice') (out as Record<string, unknown>)[key] = Number(v);
    else if (key === 'purchaseDate') out.purchaseDate = v === null || v === '' ? null : String(v).slice(0, 10);
    else (out as Record<string, unknown>)[key] = String(v).trim();
  }
  return out;
}

/** Why these details cannot be saved, or null. `today` is the farm's day (YYYY-MM-DD). */
export function cattleEditProblem(d: Partial<CattleDetails>, today: string): CattleEditProblem | null {
  if (d.sex !== undefined && d.sex !== 'Male' && d.sex !== 'Female') return 'sex';
  if (d.purchaseDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.purchaseDate) || Number.isNaN(Date.parse(d.purchaseDate))) return 'date';
    if (d.purchaseDate > today) return 'futureDate';
  }
  for (const n of [d.unitPrice, d.totalPrice]) if (n !== undefined && !(Number.isFinite(n) && n >= 0)) return 'price';
  for (const s of [d.breed, d.age, d.ownerName, d.phone, d.paymentMethod]) if (s !== undefined && s.length > 100) return 'tooLong';
  if (d.remark !== undefined && d.remark.length > 500) return 'tooLong';
  return null;
}

export const CATTLE_EDIT_TEXT: Record<CattleEditProblem, string> = {
  sex: 'Choose male or female.',
  date: 'Enter the date the animal arrived.',
  futureDate: 'The arrival date cannot be in the future.',
  price: 'A price must be a number, 0 or more.',
  tooLong: 'One of the details is too long.',
};
