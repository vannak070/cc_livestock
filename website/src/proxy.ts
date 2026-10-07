import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LANG } from '@/lib/i18n/langs';

/** The home address opens the site in the default language (English for now). */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL(`/${DEFAULT_LANG}`, request.url));
}

export const config = { matcher: '/' };
