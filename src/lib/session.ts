import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { signAuthToken, verifyAuthToken } from './jwt';
import { Actor, AuthzError, assertPermission, loadActor } from './authz';
import { PermissionKey } from './types';

/**
 * Web session: the same signed token the mobile app gets, but kept in an
 * httpOnly cookie so page JavaScript can never read it, and so the server
 * can tell who is asking before it renders any data (see src/app/page.tsx)
 * and before it runs any server action (see src/app/actions.ts).
 */
const SESSION_COOKIE = 'cc_session';
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // matches the token's own 30d expiry (src/lib/jwt.ts)

export async function startSession(actor: Actor): Promise<void> {
  const token = signAuthToken({ sub: actor.id, email: actor.email, role: actor.role, farmLocation: actor.farmLocation });
  // Mark the cookie Secure whenever the site is reached over HTTPS. It is not
  // forced on unconditionally because the production site is still served
  // over plain HTTP, where a Secure cookie would never be stored and nobody
  // could sign in.
  const proto = (await headers()).get('x-forwarded-proto');
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in, still-active user for this request, or null. Memoized per request. */
export const getSessionActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await loadActor(verifyAuthToken(token).sub);
  } catch {
    return null;
  }
});

/**
 * For server actions: throws unless someone is signed in and, when
 * permissions are given, holds at least one of them.
 */
export async function requireSessionActor(...anyOf: PermissionKey[]): Promise<Actor> {
  const actor = await getSessionActor();
  if (!actor) throw new AuthzError('Your session has expired. Please sign in again.', 401);
  assertPermission(actor, ...anyOf);
  return actor;
}
