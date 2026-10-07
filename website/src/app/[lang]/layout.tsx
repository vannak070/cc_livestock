import type { Metadata } from 'next';
import { Fraunces, Kantumruy_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { Footer } from '@/components/layout/Footer';
import { ContactBar } from '@/components/layout/ContactBar';
import { Header } from '@/components/layout/Header';
import { VisitCounter } from '@/components/shared/VisitCounter';
import { ENABLED_LANGS } from '@/lib/i18n';
import { layoutLang, siteUrl } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

const body = Kantumruy_Pro({ subsets: ['khmer', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Fraunces({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display', display: 'swap' });

export const revalidate = 60;

// Only the switched-on languages exist; any other first part of the address is an unknown page (app/global-not-found.tsx).
export const dynamicParams = false;

export function generateStaticParams() {
  return ENABLED_LANGS.map(lang => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang, t } = await layoutLang(params);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.title, template: `%s · ${t.brand.km} ${t.brand.en}` },
    description: t.meta.description,
    icons: { icon: '/logo.png', apple: '/logo.png' },
    alternates: { languages: Object.fromEntries(ENABLED_LANGS.map(l => [l, `/${l}`])) },
    openGraph: { title: t.meta.title, description: t.meta.description, locale: lang === 'km' ? 'km_KH' : 'en_US', type: 'website', siteName: 'CamCow' },
  };
}

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang, t } = await layoutLang(params);
  // "Stories" is left out of the menus until there is one.
  const hasNews = (await getSnapshot()).news.length > 0;
  return (
    <html lang={lang} className={`${body.variable} ${display.variable}`} data-scroll-behavior="smooth">
      <body>
        <Header lang={lang} t={t} hasNews={hasNews} />
        <main>{children}</main>
        <Footer lang={lang} t={t} hasNews={hasNews} />
        <ContactBar t={t} />
        <VisitCounter />
      </body>
    </html>
  );
}
