/**
 * Security headers for every page (used by next.config.ts, so keep this file free of imports).
 *
 * The content security policy lists where the browser may load things from. This site needs only:
 *  - its own scripts (Next adds small inline scripts to start up, so 'unsafe-inline'; a per-request nonce would
 *    make every page render on demand and lose the pre-built pages),
 *  - its own styles (inline styles come from React style props),
 *  - map tiles from OpenStreetMap (Leaflet), and images from itself (photos, logos), data: and blob:,
 *  - fetch calls to itself only (the forms and visit counts go to /public/v1/...).
 * Fonts are served from this site (next/font). Nothing may frame the site, and forms may only post to it.
 */
export function contentSecurityPolicy(dev = false): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const lines = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev) lines.push('upgrade-insecure-requests');
  return lines.join('; ');
}

export function securityHeaders(dev = false): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(dev) },
    // Only honoured over HTTPS, so it does nothing on localhost. One year; subdomains included.
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  ];
}
