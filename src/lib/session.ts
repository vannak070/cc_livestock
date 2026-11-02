import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { Actor, AuthzError, assertPermission } from './authz';
import { PermissionKey } from './types';
import { cookieSecure } from './server-security';
import { atLongestSession } from './session-policy';
import { sessionService, type IssuedSession } from '../services/session.service';

/**
 * Web session: the same signed token the mobile app gets, but kept in an
 * httpOnly cookie so page JavaScript can never read it, and so the server
 * can tell who is asking before it renders any data (see src/app/page.tsx)
 * and before it runs any server action (see src/app/actions.ts).
 *
 * The sign-in runs out after the idle time (60 minutes unless the Super Admin
 * chose otherwise) and after 12 hours at most (src/lib/session-policy.ts). Only
 * real activity in the app renews it (POST /api/session, sent by
 * src/components/providers/IdleSignOut.tsx); loading data or background checks
 * do not.
 */
const SESSION_COOKIE = 'cc_session';

async function setCookie(issued: IssuedSession): Promise<void> {
  // Marked Secure whenever the site is reached over HTTPS (or SESSION_COOKIE_SECURE=true says so). It is not forced
  // unconditionally while a site is still served over plain HTTP, where a Secure cookie would never be stored and
  // nobody could sign in. Set SESSION_COOKIE_SECURE=true as soon as the site has HTTPS.
  const proto = (await headers()).get('x-forwarded-proto');
  (await cookies()).set(SESSION_COOKIE, issued.token, {
    httpOnly: true,
    secure: cookieSecure(process.env, proto),
    sameSite: 'lax',
    path: '/',
    // The browser drops it when the token runs out.
    maxAge: Math.max(0, issued.expiresAt - Math.floor(Date.now() / 1000))
  });
}

/** A fresh sign-in (after the password, or after the person changed their own password). */
export async function startSession(actor: Actor): Promise<void> {
  await setCookie(await sessionService.issue(actor));
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

const readSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await sessionService.check(token);
  } catch {
    return null;
  }
});

/** The signed-in, still-active user for this request, or null. Memoized per request. */
export const getSessionActor = cache(async (): Promise<Actor | null> => (await readSession())?.actor ?? null);

/** When this request's sign-in runs out, for the screen's warning. */
export async function getSessionTiming(): Promise<{ expiresAt: number; idleMinutes: number } | null> {
  const s = await readSession();
  return s?.payload.exp ? { expiresAt: s.payload.exp, idleMinutes: await sessionService.idleMinutes() } : null;
}

/**
 * The person is active: give the sign-in the full idle time again (at most once a minute, never past the longest
 * session). Null when there is no valid sign-in any more.
 */
export async function renewSession(): Promise<{ expiresAt: number; idleMinutes: number; atLongest: boolean } | null> {
  const s = await readSession();
  if (!s) return null;
  if (!sessionService.dueForRenewal(s.payload)) {
    const idle = await sessionService.idleMinutes();
    const expiresAt = s.payload.exp ?? 0;
    return { expiresAt, idleMinutes: idle, atLongest: atLongestSession(s.payload.signedInAt, expiresAt) };
  }
  const issued = await sessionService.issue(s.actor, s.payload.signedInAt);
  await setCookie(issued);
  return { expiresAt: issued.expiresAt, idleMinutes: issued.idleMinutes, atLongest: issued.atLongest };
}

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
