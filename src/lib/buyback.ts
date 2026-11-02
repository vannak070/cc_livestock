/**
 * A sale to CC Livestock itself is a buy-back: CC Livestock buys the finished
 * cattle back from the farm. It is marked by the buyer's name on the sale record
 * (no extra column), so Sales shows it and the reports can tell it from a sale
 * to anyone else. Browser-safe.
 */
export const BUYBACK_BUYER = 'CC Livestock';

/** True for a sale recorded as a buy-back (any spelling of CC Livestock / CamCow as the buyer). */
export function isBuybackSale(sale: { buyer?: string }): boolean {
  const b = (sale.buyer ?? '').trim().toLowerCase();
  return b === 'cc livestock' || b === 'camcow' || b === 'cam cow' || b === 'ខេមខោវ' || b === 'ខេម ខោវ';
}
