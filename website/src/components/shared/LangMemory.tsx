'use client';

import { useEffect } from 'react';
import { LANG_COOKIE, type Lang } from '@/lib/i18n/langs';

/**
 * Remembers the language of the page being read, for a year, so the home address and the installed app open in it.
 * A plain preference cookie: it holds only "en" or "km" and is never sent anywhere else.
 */
export function LangMemory({ lang }: { lang: Lang }) {
  useEffect(() => {
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // cookies blocked: the site still works, it just opens in English next time
    }
  }, [lang]);
  return null;
}
