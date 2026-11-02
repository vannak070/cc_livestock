import { describe, expect, it } from 'vitest';
import { appContentSecurityPolicy, makeNonce } from './app-csp';

const directive = (policy: string, name: string) => policy.split('; ').find(d => d.startsWith(`${name} `)) ?? '';

describe('appContentSecurityPolicy', () => {
  it('lets scripts run only with the nonce, and never eval in production', () => {
    const p = appContentSecurityPolicy('abc');
    expect(directive(p, 'script-src')).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(p).not.toContain('unsafe-eval');
    expect(directive(p, 'script-src')).not.toContain('unsafe-inline');
  });

  it('keeps fetches, framing, forms and plugins on this site', () => {
    const p = appContentSecurityPolicy('abc');
    expect(directive(p, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(p, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(p, 'form-action')).toBe("form-action 'self'");
    expect(directive(p, 'object-src')).toBe("object-src 'none'");
    expect(p).toContain('upgrade-insecure-requests');
  });

  it('allows eval and the reload socket in development only', () => {
    const p = appContentSecurityPolicy('abc', true);
    expect(directive(p, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(p, 'connect-src')).toContain('ws://localhost:*');
    expect(p).not.toContain('upgrade-insecure-requests');
  });
});

describe('makeNonce', () => {
  it('is long, base64 and different each time', () => {
    const a = makeNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(makeNonce()).not.toBe(a);
  });
});
