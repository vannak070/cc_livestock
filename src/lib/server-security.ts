// Small pure rules for how the servers are exposed. Kept apart from the servers so each one has a test.

/** The sample secret used when none is set while developing. It must never sign a real login. */
export const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';
export const MIN_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

const isDevLike = (nodeEnv?: string) => nodeEnv === 'development' || nodeEnv === 'test';

/**
 * The secret that signs logins, or the reason there must not be one. Only development and tests may fall back to
 * the sample secret; an unset NODE_ENV counts as a real server.
 */
export function resolveJwtSecret(env: Env): { secret: string } | { error: string } {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) {
    return isDevLike(env.NODE_ENV)
      ? { secret: DEV_JWT_SECRET }
      : { error: '[Auth] JWT_SECRET is required unless NODE_ENV is "development" or "test".' };
  }
  if (!isDevLike(env.NODE_ENV) && (secret === DEV_JWT_SECRET || secret.length < MIN_SECRET_LENGTH)) {
    return { error: `[Auth] JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters and not the sample value when NODE_ENV is not "development".` };
  }
  return { secret };
}

/**
 * Which websites may call the API from a browser. CORS_ORIGIN can list several addresses separated by commas.
 * Unset in production means none (the website and API are then reached through the same address); unset while
 * developing means any. An explicit "*" is honored, but the production check warns about it.
 */
export function corsOrigins(env: Env): string[] | '*' | false {
  const raw = env.CORS_ORIGIN?.trim();
  if (!raw) return isDevLike(env.NODE_ENV) ? '*' : false;
  if (raw === '*') return '*';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : false;
}

/**
 * Whether the session cookie is marked Secure (browsers then send it only over HTTPS). SESSION_COOKIE_SECURE=true
 * or false decides it; otherwise it follows how the request arrived (the proxy's X-Forwarded-Proto).
 */
export function cookieSecure(env: Env, forwardedProto: string | null | undefined): boolean {
  const v = env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return forwardedProto === 'https';
}

/**
 * Which proxies in front of the API are believed about the caller's address. Only the same machine by default
 * ("loopback", for nginx next to the app), so a caller cannot invent an address with its own X-Forwarded-For.
 */
export function trustProxySetting(env: Env): string | number | boolean {
  const v = env.TRUST_PROXY?.trim();
  if (!v) return 'loopback';
  if (v === 'true') return true;
  if (v === 'false') return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}
