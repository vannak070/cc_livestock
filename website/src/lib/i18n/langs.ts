/**
 * The website's languages. English is the default; Khmer (km.ts) is switched on
 * in ENABLED_LANGS (its wording still needs a native speaker's review).
 */
export const LANGS = ['en', 'km'] as const;
export type Lang = (typeof LANGS)[number];

/** Languages visitors can open now. Add 'km' here to switch Khmer on (and the header switch appears). */
export const ENABLED_LANGS: readonly Lang[] = ['en', 'km'];
export const DEFAULT_LANG: Lang = 'en';

export const isLang = (v: string): v is Lang => (ENABLED_LANGS as readonly string[]).includes(v);

/** A link inside the site, in the given language: href('en', '/members') -> '/en/members'. */
export const href = (lang: Lang, p = '/') => `/${lang}${p === '/' ? '' : p}`;
