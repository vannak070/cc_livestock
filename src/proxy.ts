import { NextResponse, type NextRequest } from 'next/server';
import { appContentSecurityPolicy, makeNonce } from '@/lib/app-csp';

/**
 * Gives every page load its own script nonce and the strict content security policy (src/lib/app-csp.ts).
 * Next.js reads the nonce from the request's policy header and adds it to its scripts; the page is rendered per
 * request anyway (it reads the sign-in cookie), so nothing pre-built is lost.
 */
export function proxy(request: NextRequest) {
  const policy = appContentSecurityPolicy(makeNonce(), process.env.NODE_ENV === 'development');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, Next's own files, or anything with a file extension (icons, sw.js, offline.html).
      source: '/((?!api|_next/static|_next/image|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
