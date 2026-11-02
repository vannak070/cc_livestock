import type { MasterSetup } from './types';

/**
 * Sign-in time limits (user, 2026-10-30). Anyone who does nothing for the idle time is signed out; nobody stays
 * signed in longer than MAX_SESSION_HOURS, however active. The server enforces both through the token's own expiry
 * (src/lib/session.ts, src/middleware/auth.middleware.ts); the screen only warns and clears itself
 * (src/components/providers/IdleSignOut.tsx). Pure, so the browser and tests can use it.
 */
export const DEFAULT_IDLE_MINUTES = 60;
/** The choices a Super Admin has in Settings → Sign-in. */
export const IDLE_MINUTE_CHOICES = [15, 30, 60, 120, 240] as const;
export const MAX_SESSION_HOURS = 12;
/** The warning shows this long before the sign-out. */
export const WARN_BEFORE_MS = 5 * 60 * 1000;
/** Activity renews the sign-in at most this often, so the server's clock is never more than a minute behind. */
export const RENEW_EVERY_MS = 60 * 1000;

export type SessionPolicy = NonNullable<MasterSetup['session']>;

export function idleMinutes(policy: SessionPolicy | null | undefined): number {
  const m = policy?.idleMinutes;
  return typeof m === 'number' && (IDLE_MINUTE_CHOICES as readonly number[]).includes(m) ? m : DEFAULT_IDLE_MINUTES;
}

export function sessionPolicyProblem(policy: unknown): string | null {
  const m = (policy as SessionPolicy | null)?.idleMinutes;
  if (typeof m !== 'number' || !(IDLE_MINUTE_CHOICES as readonly number[]).includes(m)) {
    return `Choose one of: ${IDLE_MINUTE_CHOICES.join(', ')} minutes.`;
  }
  return null;
}

/** Only the Super Admin changes the sign-in time limit. */
export const canSetSessionPolicy = (actor: { role?: string } | null | undefined): boolean => actor?.role === 'Super Admin';

/**
 * When a sign-in made at `signedInAt` and renewed at `now` (both seconds) runs out: the idle time from now, but never
 * past the longest session. Returns seconds.
 */
export function sessionExpiry(signedInAt: number, now: number, idleMin: number): number {
  return Math.min(now + idleMin * 60, signedInAt + MAX_SESSION_HOURS * 3600);
}

/** True when the sign-in has reached its longest session, so renewing cannot give it more time. */
export const atLongestSession = (signedInAt: number, expiresAt: number): boolean =>
  expiresAt >= signedInAt + MAX_SESSION_HOURS * 3600;

export const sessionPolicyOf = (settings: Pick<MasterSetup, 'session'> | null | undefined): SessionPolicy =>
  ({ idleMinutes: idleMinutes(settings?.session) });
