/**
 * The content security policy for the system app's pages (sent by src/proxy.ts, a fresh nonce per page load).
 *
 * Scripts only run when they carry this page load's nonce (Next.js adds it to its own scripts) or are loaded by one
 * that does ('strict-dynamic', for the tabs and Excel/QR code loaded on demand). So a script slipped into the page
 * through stored text cannot run, and nothing may be fetched from or sent to another site (connect-src 'self').
 * Styles allow inline because React style props and the chart/menu libraries set them.
 * Pure and dependency-free so it can be tested.
 */
export function appContentSecurityPolicy(nonce: string, dev = false): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Cattle photos and receipt pictures are shown from data: and blob: addresses made in the browser.
    'img-src': ["'self'", 'data:', 'blob:'],
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

/** 16 random bytes, base64: unguessable and different for every page load. */
export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
