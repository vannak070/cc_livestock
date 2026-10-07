import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/page';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/public/v1/'] }], sitemap: `${siteUrl()}/sitemap.xml` };
}
