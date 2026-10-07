import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHead } from '@/components/shared/PageHead';
import { ABOUT } from '@/lib/about';
import { CONTACT } from '@/lib/contact';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { KmWords } from '@/components/shared/KmWords';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.contact.title, description: t.contact.sub };
}

const Icon = ({ children }: { children: ReactNode }) => (
  <span className="ct-icon" aria-hidden="true">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  </span>
);

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const address = ABOUT.address || t.contact.officeText;
  const tabs = t.home.tabs;
  const help = [
    { tab: tabs.farmer, to: href(lang, '/join') },
    { tab: tabs.buyer, to: `${href(lang, '/cattle')}#inquiry` },
    { tab: tabs.investor, to: `${href(lang, '/join')}?role=investor#apply` },
  ];
  return (
    <>
      <PageHead eyebrow={t.eyebrow.contact} title={t.contact.title} sub={t.contact.sub} />
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap stack" style={{ gap: 44 }}>
          <div className="ct-grid">
            <div className="ct-card">
              <Icon><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></Icon>
              <h2>{t.common.phone}</h2>
              <a className="ct-big" href={`tel:${CONTACT.phoneTel}`}>{CONTACT.phone}</a>
              <a className="btn btn-green" href={`tel:${CONTACT.phoneTel}`}>{t.contact.call}</a>
            </div>
            <div className="ct-card">
              <Icon><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></Icon>
              <h2>{t.common.facebook}</h2>
              <span className="ct-big ct-name">ខេម ខោវ Cam Cow</span>
              <a className="btn btn-line" href={CONTACT.facebook} target="_blank" rel="noopener noreferrer">{t.contact.open}</a>
            </div>
            <div className="ct-card">
              <Icon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></Icon>
              <h2>{t.contact.office}</h2>
              <p className="ct-address">{address}</p>
              {ABOUT.hours && <p className="ct-address">{ABOUT.hours}</p>}
              <a className="btn btn-line" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">{t.contact.directions}</a>
            </div>
          </div>

          <div className="stack" style={{ gap: 18 }}>
            <h2 className="display h3"><KmWords text={t.contact.helpTitle} /></h2>
            <div className="ct-help">
              {help.map(({ tab, to }) => (
                <Link key={tab.label} href={to} className="ct-help-card">
                  <span className="ct-help-label">{tab.label}</span>
                  <b>{tab.title}</b>
                  <span>{tab.body}</span>
                  <span className="ct-help-cta">{tab.cta} <span aria-hidden="true">→</span></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
