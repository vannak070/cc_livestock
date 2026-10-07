/**
 * The website's languages. English first for now; the Khmer text (km.ts) is
 * kept and comes back by adding 'km' to ENABLED_LANGS once a native speaker
 * has reviewed it.
 */
export const LANGS = ['en', 'km'] as const;
export type Lang = (typeof LANGS)[number];

/** Languages visitors can open now. Add 'km' here to switch Khmer on (and the header switch appears). */
export const ENABLED_LANGS: readonly Lang[] = ['en'];
export const DEFAULT_LANG: Lang = 'en';

export const isLang = (v: string): v is Lang => (ENABLED_LANGS as readonly string[]).includes(v);

/** A link inside the site, in the given language: href('en', '/members') -> '/en/members'. */
export const href = (lang: Lang, p = '/') => `/${lang}${p === '/' ? '' : p}`;
