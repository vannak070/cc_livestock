import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

describe('security headers', () => {
  it('lets the site load only what it needs', () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('https://*.tile.openstreetmap.org');
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/https?:\/\/(?!\*\.tile\.openstreetmap\.org)/);
  });
  it('allows eval and websockets only in development (hot reload)', () => {
    const csp = contentSecurityPolicy(true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws://localhost:*');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
  it('sends the usual protective headers', () => {
    const names = securityHeaders().map(h => h.key);
    for (const k of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) expect(names).toContain(k);
  });
});
