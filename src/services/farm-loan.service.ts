import { farmLoanRepository } from '../repositories/farm-loan.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { Actor, assertPlanningAccess } from '../lib/authz';
import { parseLoanAssumptions, parseLoanTerms } from '../lib/farm-loan';
import type { FarmLoanRecord } from '../lib/types';

const MAX_NOTES = 1000;

/**
 * Farm loans live under Planning, so the same people (Super Admin, Admin,
 * Management) may read, save and remove them. The farm must exist.
 */
export class FarmLoanService {
  async getAll(): Promise<FarmLoanRecord[]> {
    return farmLoanRepository.findAll();
  }

  async save(actor: Actor, farm: unknown, rawTerms: unknown, rawAssumptions: unknown, rawNotes: unknown): Promise<FarmLoanRecord> {
    assertPlanningAccess(actor);
    const settings = await settingsRepository.getSettings();
    const name = typeof farm === 'string' ? farm.trim() : '';
    if (!(settings.farms ?? []).some(f => f.name === name)) throw new Error('Choose one of the farms.');
    const terms = parseLoanTerms(rawTerms);
    if (typeof terms === 'string') throw new Error(terms);
    const assumptions = parseLoanAssumptions(rawAssumptions);
    if (typeof assumptions === 'string') throw new Error(assumptions);
    const notes = typeof rawNotes === 'string' ? rawNotes.trim() : '';
    if (notes.length > MAX_NOTES) throw new Error(`Keep the notes under ${MAX_NOTES} letters.`);
    return farmLoanRepository.save(name, terms, assumptions, notes, actor.name);
  }

  async remove(actor: Actor, farm: string): Promise<boolean> {
    assertPlanningAccess(actor);
    return farmLoanRepository.delete(farm);
  }
}

export const farmLoanService = new FarmLoanService();
