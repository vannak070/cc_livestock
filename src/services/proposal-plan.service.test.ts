import { beforeEach, describe, expect, it, vi } from 'vitest';

const plans = vi.hoisted(() => ({ findAll: vi.fn(), save: vi.fn(), delete: vi.fn() }));
const ops = vi.hoisted(() => ({ programs: vi.fn() }));
vi.mock('../repositories/proposal-plan.repository', () => ({ proposalPlanRepository: plans }));
vi.mock('../repositories/ops-program.repository', () => ({ opsProgramRepository: ops }));

import { ProposalPlanService } from './proposal-plan.service';
import { DEFAULT_PLAN } from '../lib/proposal-plan';

const service = new ProposalPlanService();

beforeEach(() => {
  Object.values(plans).forEach(f => f.mockReset());
  ops.programs.mockReset().mockResolvedValue([]);
  plans.save.mockImplementation(async (slot: number, name: string) => ({ slot, name }));
});

describe('ProposalPlanService.savePlan', () => {
  it('saves valid numbers into a slot, with the name trimmed', async () => {
    await service.savePlan(3, '  Option 3  ', DEFAULT_PLAN, 'Mara');
    expect(plans.save).toHaveBeenCalledWith(3, 'Option 3', expect.any(Object), 'Mara');
  });

  it('calls an unnamed plan "Plan <slot>" and cuts a very long name at 60 letters', async () => {
    await service.savePlan(4, '   ', DEFAULT_PLAN);
    expect(plans.save).toHaveBeenLastCalledWith(4, 'Plan 4', expect.any(Object), undefined);
    await service.savePlan(4, 'x'.repeat(100), DEFAULT_PLAN);
    expect(plans.save.mock.calls[1][1]).toHaveLength(60);
  });

  it.each([[0], [11], [1.5], ['2'], [null]])('refuses slot %j', async slot => {
    await expect(service.savePlan(slot, 'x', DEFAULT_PLAN)).rejects.toThrow(/slot is a whole number from 1 to 10/);
    expect(plans.save).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing', undefined],
    ['a number that is negative', { ...DEFAULT_PLAN, bankInterestRateAnnual: -1 }],
    ['a number that is not finite', { ...DEFAULT_PLAN, bankInterestRateAnnual: Infinity }],
    ['a number that is text', { ...DEFAULT_PLAN, bankInterestRateAnnual: '8' }],
  ])('refuses plan numbers that are %s', async (_what, params) => {
    await expect(service.savePlan(1, 'x', params)).rejects.toThrow(/incomplete or not valid/);
    expect(plans.save).not.toHaveBeenCalled();
  });
});

describe('ProposalPlanService.deletePlan', () => {
  it('deletes a plan in a valid slot and refuses a slot that cannot exist', async () => {
    plans.delete.mockResolvedValue(true);
    await expect(service.deletePlan(2)).resolves.toBe(true);
    await expect(service.deletePlan(0)).rejects.toThrow(/slot/);
    expect(plans.delete).toHaveBeenCalledTimes(1);
  });

  it('refuses to delete a plan a farm\'s action plan is made from, and names the farms', async () => {
    ops.programs.mockResolvedValue([
      { farm: 'SNR Farm', planSlot: 2, status: 'Active' },
      { farm: 'CC_001', planSlot: 2, status: 'Paused' },
      { farm: 'Other', planSlot: 3, status: 'Active' },
    ]);
    await expect(service.deletePlan(2)).rejects.toThrow(/Plan 2 is used by the action plan of CC_001, SNR Farm/);
    expect(plans.delete).not.toHaveBeenCalled();
    // A plan used only by another slot's farms, or by a closed program, can still be deleted.
    plans.delete.mockResolvedValue(true);
    await expect(service.deletePlan(1)).resolves.toBe(true);
    ops.programs.mockResolvedValue([{ farm: 'SNR Farm', planSlot: 2, status: 'Closed' }]);
    await expect(service.deletePlan(2)).resolves.toBe(true);
  });

  it('deletes normally when the program tables do not exist yet', async () => {
    ops.programs.mockRejectedValue(new Error('relation "farm_programs" does not exist'));
    plans.delete.mockResolvedValue(true);
    await expect(service.deletePlan(2)).resolves.toBe(true);
  });
});
