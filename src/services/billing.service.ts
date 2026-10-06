import { registrationRepository } from '../repositories/registration.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { Actor, AuthzError } from '../lib/authz';
import { billingProblem, canSeeBilling, isMonth, monthStatement, recentMonths, shiftMonth, type BillingView } from '../lib/billing';
import { farmToday } from '../lib/daily-feed';
import type { BillingSettings, CattleRegistration } from '../lib/types';

/** What CC Livestock is billed for cattle registrations. Super Admin and Admin only. */
export class BillingService {
  private assertAllowed(actor: Actor): void {
    if (!canSeeBilling(actor)) throw new AuthzError('Only a Super Admin or Admin can see or change the billing.', 403);
  }

  /** One month's statement plus the last 12 months' totals. */
  async view(actor: Actor, month?: string): Promise<BillingView> {
    this.assertAllowed(actor);
    const currentMonth = farmToday().slice(0, 7);
    const chosen = month ?? currentMonth;
    if (!isMonth(chosen)) throw new Error('Choose a month (year and month).');
    const settings = (await settingsRepository.getSettings()).billing ?? { prices: [] };
    // Twelve months ending at the later of the chosen and current month, so the table always covers the chosen one.
    const end = chosen > currentMonth ? chosen : currentMonth;
    const start = shiftMonth(end, -11) < chosen ? shiftMonth(end, -11) : chosen;
    const registrations: CattleRegistration[] = await registrationRepository.between(start, end);
    return {
      settings,
      month: chosen,
      statement: monthStatement(chosen, registrations, settings),
      recent: recentMonths(end, 12, registrations, settings),
      currentMonth,
    };
  }

  /** Saves the whole price list. */
  async savePrices(actor: Actor, billing: BillingSettings): Promise<BillingSettings> {
    this.assertAllowed(actor);
    const problem = billingProblem(billing);
    if (problem) throw new Error(problem);
    const clean: BillingSettings = { prices: billing.prices.map(p => ({ from: p.from, price: p.price })).sort((a, b) => a.from.localeCompare(b.from)) };
    await settingsRepository.patchBlob({ billing: clean });
    return clean;
  }
}

export const billingService = new BillingService();
