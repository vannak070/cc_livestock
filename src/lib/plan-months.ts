/** A plan's fattening counted in whole months: cattle are traded once a month, so 110 days counts as 4 months (120 days). */
export const planMonths = (p: { fatteningPeriodDays: number }) => Math.max(1, Math.round(p.fatteningPeriodDays / 30));
/** The fattening in days as every figure counts it, so one animal, a batch and a year agree. */
export const planDays = (p: { fatteningPeriodDays: number }) => planMonths(p) * 30;
