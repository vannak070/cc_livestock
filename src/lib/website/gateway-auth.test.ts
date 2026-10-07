import { describe, it, expect } from 'vitest';
import { bearerToken, configuredKey, keyedLimit, keyMatches, MIN_KEY_LENGTH, slidingLimit } from './gateway-auth';

const KEY = 'k'.repeat(40);

describe('the shared key', () => {
  it('is set only when long enough, trimmed', () => {
    expect(configuredKey(undefined)).toBeNull();
    expect(configuredKey('')).toBeNull();
    expect(configuredKey('short')).toBeNull();
    expect(configuredKey('x'.repeat(MIN_KEY_LENGTH - 1))).toBeNull();
    expect(configuredKey(`  ${KEY}\n`)).toBe(KEY);
  });
  it('reads the bearer token', () => {
    expect(bearerToken(`Bearer ${KEY}`)).toBe(KEY);
    expect(bearerToken(KEY)).toBeUndefined();
    expect(bearerToken('Basic abc')).toBeUndefined();
    expect(bearerToken('Bearer')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
  it('matches only the exact key', () => {
    expect(keyMatches(KEY, KEY)).toBe(true);
    expect(keyMatches(KEY + 'x', KEY)).toBe(false);
    expect(keyMatches(KEY.slice(1), KEY)).toBe(false);
    expect(keyMatches('', KEY)).toBe(false);
    expect(keyMatches(undefined, KEY)).toBe(false);
  });
});

describe('limits', () => {
  it('allows a number of hits per window, then refuses until it passes', () => {
    const over = slidingLimit(3, 1000);
    expect([over(0), over(100), over(200)]).toEqual([false, false, false]);
    expect(over(300)).toBe(true);
    expect(over(1001)).toBe(false); // the first hit has left the window
  });
  it('counts each key separately', () => {
    const over = keyedLimit(2, 1000);
    expect([over('a', 0), over('a', 1), over('a', 2)]).toEqual([false, false, true]);
    expect(over('b', 3)).toBe(false);
  });
});
