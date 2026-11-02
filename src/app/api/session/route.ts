import { renewSession } from '@/lib/session';

/**
 * The person is using the app (typing, tapping, opening a page): renew their sign-in. Sent only by
 * src/components/providers/IdleSignOut.tsx after real activity, at most once a minute. 401 when the sign-in has
 * already run out. Same-site requests only: the cookie is SameSite=Lax, and requests from other sites are refused.
 */
export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return Response.json({ error: 'Not allowed' }, { status: 403 });
  const renewed = await renewSession();
  if (!renewed) return Response.json({ error: 'Signed out' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(renewed, { headers: { 'Cache-Control': 'no-store' } });
}
