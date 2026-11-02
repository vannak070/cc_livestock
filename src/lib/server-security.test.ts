import { describe, expect, it } from 'vitest';
import { DEV_JWT_SECRET, cookieSecure, corsOrigins, resolveJwtSecret, trustProxySetting } from './server-security';

const strong = 'a'.repeat(48);

describe('resolveJwtSecret', () => {
  it('lets only development and tests use the sample secret', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'development' })).toEqual({ secret: DEV_JWT_SECRET });
    expect(resolveJwtSecret({ NODE_ENV: 'test' })).toEqual({ secret: DEV_JWT_SECRET });
  });
  it.each([['production'], [undefined], ['staging']])('refuses a missing secret when NODE_ENV is %s', env => {
    expect(resolveJwtSecret({ NODE_ENV: env })).toHaveProperty('error');
  });
  it('refuses a short secret or the sample value on a real server, not in development', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toHaveProperty('error');
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: DEV_JWT_SECRET })).toHaveProperty('error');
    expect(resolveJwtSecret({ NODE_ENV: 'development', JWT_SECRET: 'short' })).toEqual({ secret: 'short' });
  });
  it('uses a strong secret as it is', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: ` ${strong} ` })).toEqual({ secret: strong });
  });
});

describe('corsOrigins', () => {
  it('allows anyone while developing and no one in production when unset', () => {
    expect(corsOrigins({ NODE_ENV: 'development' })).toBe('*');
    expect(corsOrigins({ NODE_ENV: 'production' })).toBe(false);
    expect(corsOrigins({})).toBe(false);
  });
  it('takes a list of addresses, or an explicit *', () => {
    expect(corsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: 'https://a.test, https://b.test' })).toEqual(['https://a.test', 'https://b.test']);
    expect(corsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: '*' })).toBe('*');
    expect(corsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: ' , ' })).toBe(false);
  });
});

describe('cookieSecure', () => {
  it('follows the request unless the setting says otherwise', () => {
    expect(cookieSecure({}, 'https')).toBe(true);
    expect(cookieSecure({}, 'http')).toBe(false);
    expect(cookieSecure({}, null)).toBe(false);
    expect(cookieSecure({ SESSION_COOKIE_SECURE: 'true' }, 'http')).toBe(true);
    expect(cookieSecure({ SESSION_COOKIE_SECURE: 'false' }, 'https')).toBe(false);
    expect(cookieSecure({ SESSION_COOKIE_SECURE: 'auto' }, 'https')).toBe(true);
  });
});

describe('trustProxySetting', () => {
  it('trusts only the same machine by default', () => {
    expect(trustProxySetting({})).toBe('loopback');
    expect(trustProxySetting({ TRUST_PROXY: '1' })).toBe(1);
    expect(trustProxySetting({ TRUST_PROXY: 'false' })).toBe(false);
    expect(trustProxySetting({ TRUST_PROXY: '10.0.0.0/8' })).toBe('10.0.0.0/8');
  });
});
