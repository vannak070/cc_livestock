import 'server-only';

/**
 * Shared answers for the public API (/public/v1). Reads are cached for five
 * minutes and allowed only from this website's own address (SITE_URL).
 */
const siteOrigin = () => {
  try { return new URL(process.env.SITE_URL ?? 'http://localhost:3200').origin; } catch { return 'http://localhost:3200'; }
};

const baseHeaders = () => ({
  'Access-Control-Allow-Origin': siteOrigin(),
  Vary: 'Origin',
  'X-Content-Type-Options': 'nosniff',
});

export function json(data: unknown, status = 200, cache = true): Response {
  return Response.json(data, {
    status,
    headers: { ...baseHeaders(), 'Cache-Control': cache ? 'public, max-age=300' : 'no-store' },
  });
}

/** Form sends must come from this website (or have no Origin, e.g. same-site tools). */
export function fromThisSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === siteOrigin() || origin === new URL(request.url).origin;
}

export async function readBody(request: Request, maxBytes = 20_000): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > maxBytes) return null;
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
