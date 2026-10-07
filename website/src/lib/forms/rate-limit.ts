import 'server-only';

/**
 * A simple per-address limit for the public forms: at most `max` sends per
 * hour from one address. In memory, so it resets when the site restarts;
 * enough for one server. Behind a proxy, the first x-forwarded-for address is used.
 */
const hits = new Map<string, number[]>();
const HOUR = 60 * 60 * 1000;

export function clientAddress(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'local').trim();
}

export function overLimit(key: string, max = 5, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter(t => now - t < HOUR);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return false;
}
