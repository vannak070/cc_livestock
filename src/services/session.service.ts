import { settingsRepository } from '../repositories/settings.repository';
import { Actor, AuthzError, loadActor } from '../lib/authz';
import { signAuthToken, verifyAuthToken, type AuthTokenPayload } from '../lib/jwt';
import {
  MAX_SESSION_HOURS, RENEW_EVERY_MS, atLongestSession, canSetSessionPolicy, idleMinutes, sessionExpiry, sessionPolicyProblem,
  type SessionPolicy,
} from '../lib/session-policy';
import type { UserRoleItem } from '../lib/types';

export interface IssuedSession {
  token: string;
  /** Seconds. */
  expiresAt: number;
  idleMinutes: number;
  /** The sign-in has reached its longest session: renewing gives it no more time. */
  atLongest: boolean;
}

const nowS = () => Math.floor(Date.now() / 1000);
const POLICY_CACHE_MS = 60 * 1000;

/**
 * Sign-ins and their time limits (src/lib/session-policy.ts), for both the web cookie (src/lib/session.ts) and the
 * REST bearer token (src/middleware/auth.middleware.ts). A sign-in runs out after the idle time unless it is renewed;
 * only real activity renews it, and never past the longest session.
 */
export class SessionService {
  private cached?: { minutes: number; at: number };

  async idleMinutes(): Promise<number> {
    if (this.cached && Date.now() - this.cached.at < POLICY_CACHE_MS) return this.cached.minutes;
    let minutes = idleMinutes(undefined);
    try {
      minutes = idleMinutes(await settingsRepository.getSessionSettings());
    } catch {
      // The database is unreachable: nobody can sign in anyway; keep the default.
    }
    this.cached = { minutes, at: Date.now() };
    return minutes;
  }

  /** A new sign-in, or a renewal of one made at `signedInAt`. */
  async issue(user: Pick<UserRoleItem, 'id' | 'email' | 'role' | 'farmLocation'>, signedInAt = nowS()): Promise<IssuedSession> {
    const minutes = await this.idleMinutes();
    const expiresAt = sessionExpiry(signedInAt, nowS(), minutes);
    const token = signAuthToken({ sub: user.id, email: user.email, role: user.role, farmLocation: user.farmLocation, signedInAt }, expiresAt);
    return { token, expiresAt, idleMinutes: minutes, atLongest: atLongestSession(signedInAt, expiresAt) };
  }

  /**
   * Who a token belongs to, or null when it is expired, tampered with, older than the longest session, from before
   * the account's last password change, from before these limits (no sign-in time), or the account is switched off.
   */
  async check(token: string): Promise<{ actor: Actor; payload: AuthTokenPayload & { signedInAt: number } } | null> {
    let payload: AuthTokenPayload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      return null;
    }
    const { signedInAt } = payload;
    if (typeof signedInAt !== 'number' || nowS() - signedInAt >= MAX_SESSION_HOURS * 3600) return null;
    const actor = await loadActor(payload.sub, signedInAt);
    return actor ? { actor, payload: { ...payload, signedInAt } } : null;
  }

  /** Whether a token was renewed long enough ago to renew again (activity renews at most once a minute). */
  dueForRenewal(payload: AuthTokenPayload): boolean {
    return typeof payload.iat !== 'number' || (nowS() - payload.iat) * 1000 >= RENEW_EVERY_MS;
  }

  async savePolicy(actor: Actor, policy: SessionPolicy): Promise<SessionPolicy> {
    if (!canSetSessionPolicy(actor)) throw new AuthzError('Only the Super Admin can change the sign-in time limit.', 403);
    const problem = sessionPolicyProblem(policy);
    if (problem) throw new Error(problem);
    const clean: SessionPolicy = { idleMinutes: policy.idleMinutes };
    await settingsRepository.patchBlob({ session: clean });
    this.cached = undefined;
    return clean;
  }
}

export const sessionService = new SessionService();
