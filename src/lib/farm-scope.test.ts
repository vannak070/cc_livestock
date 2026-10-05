import { describe, expect, it } from 'vitest';
import { farmMatchSql, farmMatcher, scopeFor } from './farm-scope';

describe('farmMatcher', () => {
  it('matches case- and whitespace-insensitively', () => {
    const m = farmMatcher('  Farm A ');
    expect(m('farm a')).toBe(true);
    expect(m(' FARM A  ')).toBe(true);
    expect(m('Farm B')).toBe(false);
  });

  it('never matches an empty location', () => {
    const m = farmMatcher('Farm A');
    expect(m(undefined)).toBe(false);
    expect(m(null)).toBe(false);
    expect(m('')).toBe(false);
  });

  it('treats the Khmer Rotang name and any snr name as one farm, in both directions', () => {
    for (const farm of ['រទាំង', 'SNR Farm', 'snr-2']) {
      const m = farmMatcher(farm);
      expect(m('រទាំង')).toBe(true);
      expect(m('Snr Farm')).toBe(true);
      expect(m('Farm A')).toBe(false);
    }
  });
});

describe('scopeFor', () => {
  it('is undefined for someone not tied to a farm', () => {
    expect(scopeFor({})).toBeUndefined();
    expect(scopeFor({ farmLocation: '' })).toBeUndefined();
    expect(scopeFor({ farmLocation: null })).toBeUndefined();
  });

  it('carries the farm name otherwise', () => {
    expect(scopeFor({ farmLocation: 'Farm A' })).toEqual({ farmLocation: 'Farm A' });
  });
});

describe('farmMatchSql', () => {
  it('binds the normalised farm name as a parameter and never inlines it', () => {
    const evil = "Farm A'); DROP TABLE stock; --";
    const { sql, params } = farmMatchSql('s.location', evil, 3);
    expect(params).toEqual([evil.toLowerCase()]);
    expect(sql).toContain('$3');
    expect(sql).not.toContain('DROP');
  });

  it('adds the Rotang alternatives only for the Rotang farm', () => {
    expect(farmMatchSql('location', 'Farm A', 1).sql).not.toContain('%snr%');
    expect(farmMatchSql('location', 'SNR Farm', 1).sql).toContain('%snr%');
    expect(farmMatchSql('location', 'រទាំង', 1).sql).toContain('%snr%');
  });
});
