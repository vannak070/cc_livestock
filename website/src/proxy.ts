import { NextResponse, type NextRequest } from 'next/server';
import { LANG_COOKIE, startLang } from '@/lib/i18n/langs';

/** The home address opens the site in the language the visitor used last (English the first time). */
export function proxy(request: NextRequest) {
  const lang = startLang(request.cookies.get(LANG_COOKIE)?.value);
  const response = NextResponse.redirect(new URL(`/${lang}`, request.url));
  // The answer depends on the cookie, so no shared cache may keep it.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: '/' };
