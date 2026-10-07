import { createHash, timingSafeEqual } from 'crypto';

/**
 * The shared secret between CC Livestock and the public website
 * (WEBSITE_API_KEY on both sides). It lets the website fetch the public
 * snapshot and send form entries, and nothing else.
 */

/** Shorter keys are guessable; they are treated as "not set". */
export const MIN_KEY_LENGTH = 32;

/** The configured key, or null when it is missing or too short. */
export function configuredKey(value: string | undefined = process.env.WEBSITE_API_KEY): string | null {
  const key = (value ?? '').trim();
  return key.length >= MIN_KEY_LENGTH ? key : null;
}

/** The token of an "Authorization: Bearer <token>" header. */
export function bearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = (header ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}

/** Compares in constant time, so the answer time does not reveal how much of the key was right. */
export function keyMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** At most `max` hits per `windowMs`; in memory, one process. */
export function slidingLimit(max: number, windowMs: number) {
  let hits: number[] = [];
  return (now: number = Date.now()): boolean => {
    hits = hits.filter(t => now - t < windowMs);
    if (hits.length >= max) return true;
    hits.push(now);
    return false;
  };
}

/** Like slidingLimit but counted separately per key (for example per address), with a cap on remembered keys. */
export function keyedLimit(max: number, windowMs: number, maxKeys = 5_000) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return true; }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > maxKeys) hits.clear();
    return false;
  };
}
