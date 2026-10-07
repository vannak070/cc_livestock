import { describe, expect, it } from 'vitest';
import { DISTRICTS, districtsOf } from './districts';
import { PROVINCES } from './places';
import { DISTRICTS as WEBSITE_DISTRICTS } from '../../../website/src/lib/districts';

describe('district suggestions', () => {
  it('covers every province, with no repeats inside one', () => {
    for (const p of PROVINCES) {
      const list = districtsOf(p.key);
      expect(list.length, p.key).toBeGreaterThan(0);
      expect(new Set(list).size, p.key).toBe(list.length);
    }
    expect(Object.keys(DISTRICTS).sort()).toEqual(PROVINCES.map(p => p.key).sort());
  });

  it('is the same list the public website offers', () => {
    expect(WEBSITE_DISTRICTS).toEqual(DISTRICTS);
  });

  it('gives nothing for an unknown province', () => {
    expect(districtsOf('Nowhere')).toEqual([]);
  });
});
