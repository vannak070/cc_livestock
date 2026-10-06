/**
 * Billing for cattle registrations: CC Livestock is billed a price for every
 * animal registered, once, in the month it is registered (src/lib/billing.ts).
 */
export interface BillingPrice {
  /** The first month (YYYY-MM) this price applies to. */
  from: string;
  /** ៛ per animal registered. */
  price: number;
}

export interface BillingSettings {
  /** Price history, newest rule wins for a month; the earliest `from` is when billing starts. */
  prices: BillingPrice[];
}

/** One registration record (a row of cattle_registrations). */
export interface CattleRegistration {
  cowId: string;
  farm: string;
  /** Month of registration on the farm's clock, YYYY-MM. */
  month: string;
  /** ISO time. */
  registeredAt: string;
  registeredBy: string;
  removedAt?: string;
  removedBy?: string;
  removedReason?: string;
}
