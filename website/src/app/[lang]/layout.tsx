import type { Metadata, Viewport } from 'next';
import { Fraunces, Kantumruy_Pro } from 'next/font/google';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { Footer } from '@/components/layout/Footer';
import { ContactBar } from '@/components/layout/ContactBar';
import { Header } from '@/components/layout/Header';
import { LangMemory } from '@/components/shared/LangMemory';
import { StaleCodeReload } from '@/components/shared/StaleCodeReload';
import { VisitCounter } from '@/components/shared/VisitCounter';
import { ENABLED_LANGS } from '@/lib/i18n';
import { layoutLang, siteUrl } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

const body = Kantumruy_Pro({ subsets: ['khmer', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Fraunces({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display', display: 'swap' });

// The phone's address bar takes the header's white.
export const viewport: Viewport = { themeColor: '#ffffff' };

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
    icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: 'CamCow', statusBarStyle: 'default' },
    alternates: { languages: Object.fromEntries(ENABLED_LANGS.map(l => [l, `/${l}`])) },
    openGraph: { title: t.meta.title, description: t.meta.description, locale: lang === 'km' ? 'km_KH' : 'en_US', type: 'website', siteName: 'CamCow' },
  };
}

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  // Every page is made fresh for each visit (2026-10-30). Kept pages (ISR) told browsers they could show an old copy
  // for up to a year, and right after a release served copies built without any data (no farms, empty map) until
  // they were rebuilt. The snapshot itself is kept in memory for 30 s (lib/snapshot/read.ts), so this stays fast.
  await connection();
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
        <LangMemory lang={lang} />
        <StaleCodeReload />
      </body>
    </html>
  );
}
