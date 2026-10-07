import type { MetadataRoute } from 'next';
import { ABOUT } from '@/lib/about';
import { ENABLED_LANGS } from '@/lib/i18n';
import { siteUrl } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSnapshot();
  const paths = ['', '/members', '/cattle', '/join', '/news', '/contact', ...(ABOUT.ready ? ['/about'] : []), ...s.farms.map(f => `/members/${f.slug}`), ...s.news.map(n => `/news/${n.id}`)];
  return ENABLED_LANGS.flatMap(lang => paths.map(p => ({ url: `${siteUrl()}/${lang}${p}` })));
}
