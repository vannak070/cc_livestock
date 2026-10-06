import { describe, expect, it } from 'vitest';
import { canSetLimits, limitBlock, limitBlockMessage, limitDecisionProblem, limitRequestProblem, limitState, limitUsed } from './farm-limit';

const stock = [
  { location: 'SNR Farm', status: 'Active' },
  { location: 'SNR Farm', status: 'Sold' },
  { location: ' snr farm ', status: 'Dead' },
  { location: 'Other', status: 'Active' },
];

describe('farm cattle limit', () => {
  it('counts every animal registered on the farm, sold and dead too', () => {
    expect(limitUsed('SNR Farm', stock)).toBe(3);
    expect(limitState({ name: 'SNR Farm', capacity: 5 }, stock)).toEqual({ limit: 5, used: 3, left: 2 });
  });

  it('blocks a farm with no limit, and one that is full; lets the rest through', () => {
    expect(limitBlock({ name: 'New', capacity: 0 }, 0)).toMatchObject({ reason: 'not-set' });
    expect(limitBlock({ name: 'New' }, 0)).toMatchObject({ reason: 'not-set' });
    expect(limitBlock({ name: 'SNR Farm', capacity: 3 }, 3)).toMatchObject({ reason: 'full', used: 3, limit: 3 });
    expect(limitBlock({ name: 'SNR Farm', capacity: 4 }, 3)).toBeNull();
    expect(limitBlock({ name: 'SNR Farm', capacity: 4 }, 3, 2)).toMatchObject({ reason: 'full' });
    expect(limitBlock(null, 99)).toBeNull();
    expect(limitBlockMessage({ reason: 'full', farm: 'SNR Farm', limit: 4, used: 3 }, 2)).toMatch(/room for 1 more/);
  });

  it('only Super Admin and Admin set limits', () => {
    expect(canSetLimits({ role: 'Super Admin' })).toBe(true);
    expect(canSetLimits({ role: 'Admin' })).toBe(true);
    for (const role of ['Company', 'Farm Owner', 'Management', 'Farm Staff']) expect(canSetLimits({ role })).toBe(false);
    expect(canSetLimits(null)).toBe(false);
  });

  it('checks a request and a decision', () => {
    const farms = [{ name: 'SNR Farm' }];
    expect(limitRequestProblem({ farm: 'SNR Farm', extra: 20, reason: 'New buyer' }, farms)).toBeNull();
    expect(limitRequestProblem({ farm: 'Nowhere', extra: 20, reason: '' }, farms)).toMatch(/farm/);
    expect(limitRequestProblem({ farm: 'SNR Farm', extra: 0, reason: '' }, farms)).toMatch(/how many/);
    expect(limitRequestProblem({ farm: 'SNR Farm', extra: 2.5, reason: '' }, farms)).toMatch(/how many/);
    expect(limitDecisionProblem(true, 120, 73)).toBeNull();
    expect(limitDecisionProblem(true, 70, 73)).toMatch(/cannot be lower/);
    expect(limitDecisionProblem(false, 0, 73)).toBeNull();
  });
});
