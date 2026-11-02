import { describe, expect, it } from 'vitest';
import { hasErrors, productionFindings } from './production-check';

const good = {
  NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64), DB_PASSWORD: 'a-long-random-password-1f9c', DB_HOST: 'localhost',
  CORS_ORIGIN: 'https://farm.example.com', NEXT_PUBLIC_APP_URL: 'https://farm.example.com', SESSION_COOKIE_SECURE: 'true',
  WEBSITE_API_KEY: 'k'.repeat(40), TELEGRAM_BOT_TOKEN: 't', ANTHROPIC_API_KEY: 'a',
};
const levels = (env: Record<string, string | undefined>) => productionFindings(env).map(f => f.level);

describe('productionFindings', () => {
  it('has nothing to say about a correct setup', () => {
    expect(productionFindings(good)).toEqual([]);
  });

  it('blocks a missing or weak secret, a weak database password, a wildcard CORS and an http address', () => {
    expect(hasErrors(productionFindings({ ...good, JWT_SECRET: '' }))).toBe(true);
    expect(hasErrors(productionFindings({ ...good, JWT_SECRET: 'short' }))).toBe(true);
    expect(hasErrors(productionFindings({ ...good, DB_PASSWORD: 'postgres123' }))).toBe(true);
    expect(hasErrors(productionFindings({ ...good, CORS_ORIGIN: '*' }))).toBe(true);
    expect(hasErrors(productionFindings({ ...good, NEXT_PUBLIC_APP_URL: 'http://farm.example.com' }))).toBe(true);
    expect(hasErrors(productionFindings({ ...good, SESSION_COOKIE_SECURE: 'false' }))).toBe(true);
    expect(hasErrors(productionFindings({ ...good, NODE_ENV: 'development' }))).toBe(true);
  });

  it('only warns (does not block) about a cookie setting still on auto and a missing app address', () => {
    const f = productionFindings({ ...good, SESSION_COOKIE_SECURE: undefined, NEXT_PUBLIC_APP_URL: '' });
    expect(f.map(x => x.level)).toEqual(['warning', 'warning']);
    expect(hasErrors(f)).toBe(false);
  });

  it('treats optional features as notes', () => {
    expect(levels({ ...good, WEBSITE_API_KEY: '', TELEGRAM_BOT_TOKEN: '', ANTHROPIC_API_KEY: '' })).toEqual(['info', 'info', 'info']);
  });

  it('never repeats a secret in its messages', () => {
    const text = productionFindings({ ...good, JWT_SECRET: 'SuperSecretValue', DB_PASSWORD: 'postgres123' }).map(f => f.message).join(' ');
    expect(text).not.toContain('SuperSecretValue');
    expect(text).not.toContain('postgres123');
  });
});
