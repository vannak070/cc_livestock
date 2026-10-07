import 'server-only';
import { notFound } from 'next/navigation';
import { DEFAULT_LANG, getDict, isLang, type Dict, type Lang } from './i18n';

/** Reads the [lang] part of the address; unknown languages are a 404. */
export async function pageLang(params: Promise<{ lang: string }>): Promise<{ lang: Lang; t: Dict }> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return { lang, t: getDict(lang) };
}

/** The site's own address, for share links and the sitemap. */
export const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3200').replace(/\/+$/, '');

/**
 * For the [lang] layout only: never a 404 (a layout that calls notFound() leaves
 * no page around the 404 and the visitor sees a blank screen). Unknown
 * languages never get here anyway (dynamicParams = false in the layout).
 */
export async function layoutLang(params: Promise<{ lang: string }>): Promise<{ lang: Lang; t: Dict }> {
  const { lang } = await params;
  const safe = isLang(lang) ? lang : DEFAULT_LANG;
  return { lang: safe, t: getDict(safe) };
}

