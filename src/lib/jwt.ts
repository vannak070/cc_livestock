import jwt from 'jsonwebtoken';
import { resolveJwtSecret } from './server-security';

// Fail loudly if no real secret is configured on a real server (src/lib/server-security.ts). Only development and
// tests may use the clearly-labeled insecure sample. A weak secret is refused the first time it is used (not when
// the file loads), so a build that has no secret yet still works.
const initial = resolveJwtSecret(process.env);
if ('error' in initial && !process.env.JWT_SECRET) throw new Error(initial.error);

let cached: string | undefined;
function secret(): string {
  if (cached) return cached;
  const r = resolveJwtSecret(process.env);
  if ('error' in r) throw new Error(r.error);
  return (cached = r.secret);
}

export interface AuthTokenPayload {
  sub: string;        // user id
  email: string;
  role: string;
  farmLocation?: string;
  /** Issued at (seconds), set by jsonwebtoken: when the sign-in was last renewed. */
  iat?: number;
  /**
   * When the person signed in (seconds). Kept the same when the sign-in is renewed; compared with the account's last
   * password change and with the longest session (src/lib/session-policy.ts). Tokens without it are refused.
   */
  signedInAt?: number;
  /** Expiry (seconds), set by jsonwebtoken. */
  exp?: number;
}

// Only this algorithm is accepted, so a token signed some other way (or not at all) is never trusted.
const ALGORITHM = 'HS256';

/**
 * Signs a sign-in that runs out at `expiresAt` (seconds). The time limits are worked out by the caller
 * (sessionExpiry in src/lib/session-policy.ts), so a renewed sign-in keeps its original `signedInAt`.
 */
export function signAuthToken(payload: AuthTokenPayload & { signedInAt: number }, expiresAt: number): string {
  const { sub, email, role, farmLocation, signedInAt } = payload;
  return jwt.sign({ sub, email, role, farmLocation, signedInAt, exp: expiresAt }, secret(), { algorithm: ALGORITHM });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, secret(), { algorithms: [ALGORITHM] }) as AuthTokenPayload;
}
