import { describe, expect, it } from 'vitest';
import { canEditCattleDetails, cattleEditProblem, cleanCattleDetails } from './cattle-edit';

describe('correcting an animal\'s details', () => {
  it('is for a Super Admin only', () => {
    expect(canEditCattleDetails({ role: 'Super Admin' })).toBe(true);
    for (const role of ['Admin', 'Company', 'Farm Owner', 'Farm Staff']) expect(canEditCattleDetails({ role })).toBe(false);
    expect(canEditCattleDetails(null)).toBe(false);
  });
  it('keeps only the editable details (never the tag, farm, weight or status)', () => {
    expect(cleanCattleDetails({ breed: ' Brahman ', id: 'X', location: 'Other', weight: 1, status: 'Sold', unitPrice: '12500', purchaseDate: '2026-10-20T00:00:00Z' }))
      .toEqual({ breed: 'Brahman', unitPrice: 12500, purchaseDate: '2026-10-20' });
  });
  it('checks sex, dates and prices', () => {
    const today = '2026-11-03';
    expect(cattleEditProblem({ sex: 'Male', purchaseDate: '2026-11-03', unitPrice: 0, totalPrice: 3_000_000 }, today)).toBeNull();
    expect(cattleEditProblem({ sex: 'Bull' }, today)).toBe('sex');
    expect(cattleEditProblem({ purchaseDate: '2026-11-04' }, today)).toBe('futureDate');
    expect(cattleEditProblem({ purchaseDate: '20-10-2026' }, today)).toBe('date');
    expect(cattleEditProblem({ unitPrice: -1 }, today)).toBe('price');
    expect(cattleEditProblem({ totalPrice: Number.NaN }, today)).toBe('price');
    expect(cattleEditProblem({ remark: 'x'.repeat(501) }, today)).toBe('tooLong');
  });
});
