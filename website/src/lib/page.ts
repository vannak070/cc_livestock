import 'server-only';
import { notFound } from 'next/navigation';
import { getDict, isLang, type Dict, type Lang } from './i18n';

/** Reads the [lang] part of the address; unknown languages are a 404. */
export async function pageLang(params: Promise<{ lang: string }>): Promise<{ lang: Lang; t: Dict }> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return { lang, t: getDict(lang) };
}

/** The site's own address, for share links and the sitemap. */
export const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3200').replace(/\/+$/, '');
