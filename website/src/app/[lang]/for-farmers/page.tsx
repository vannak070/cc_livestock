import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { HowTimeline } from '@/components/home/HowTimeline';
import { PageHead } from '@/components/shared/PageHead';
import { KmWords } from '@/components/shared/KmWords';
import { SectionHead } from '@/components/shared/SectionHead';
import { LoanDetails } from '@/components/stand/LoanDetails';
import { HealthyFarms, StandHeading } from '@/components/stand/StandParts';
import { CONTACT } from '@/lib/contact';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { siteImages } from '@/lib/site-images';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.farmers.title, description: t.farmers.sub };
}

/**
 * For farmers: everything a farmer needs in one place (it replaced "How it works" and "Farm loans" in the menu):
 * what a member farm gets and how an animal goes through the farm, the farm loan with ARDB, the standards, then
 * a closing card to join or ask about a loan (text beside a farm photo). /loans forwards here (#loans).
 */
export default async function ForFarmersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const f = t.farmers;
  const img = await siteImages();
  return (
    <>
      <PageHead eyebrow={t.eyebrow.farmers} title={f.pageTitle} sub={f.sub} photo={img['team-group']}>
        <nav className="jump" aria-label={f.title}>
          <a href="#how">{f.jumpHow}</a>
          <a href="#loans">{f.jumpLoans}</a>
          <a href="#standards">{f.jumpStandards}</a>
        </nav>
      </PageHead>

      <section className="section anchor" id="how" style={{ paddingTop: 40 }}>
        <div className="wrap stack" style={{ gap: 28 }}>
          <SectionHead title={f.jumpHow} intro={t.home.journeySub} />
          <div className="stack" style={{ gap: 14 }}>
            <StandHeading text={f.getTitle} />
            <ul className="fm-get">
              {t.home.offer.map(o => (
                <li key={o.title}>
                  <span className="st-tick" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg></span>
                  <span><b>{o.title}</b>{o.body}</span>
                </li>
              ))}
            </ul>
          </div>
          <HowTimeline t={t} lang={lang} />
        </div>
      </section>

      <section className="section section-paper anchor" id="loans">
        <div className="wrap stack" style={{ gap: 18 }}>
          <SectionHead title={t.loan.pageTitle} intro={t.loan.sub} />
          <LoanDetails t={t} lang={lang} />
        </div>
      </section>

      <section className="section section-white anchor" id="standards">
        <div className="wrap stack" style={{ gap: 18 }}>
          <SectionHead title={t.stand.farmTitle} />
          <HealthyFarms t={t} />
        </div>
      </section>

      <section className="section section-white" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="fm-start">
            <div className="fm-start-text">
              <h2 className="display h2"><KmWords text={f.ctaTitle} /></h2>
              <p className="lead">{f.ctaSub}</p>
              <div className="row" style={{ gap: 10 }}>
                <Link className="btn btn-red" href={href(lang, '/join')}>{f.joinCta} <span aria-hidden="true">→</span></Link>
                <a className="btn btn-line" href={`tel:${CONTACT.phoneTel}`}><span className="btn-label">{f.loanCta} · <span className="nowrap">{CONTACT.phone}</span></span></a>
              </div>
            </div>
            <div className="fm-start-photo"><Image src={img['farm-feeding']} alt="" fill sizes="(max-width: 900px) 100vw, 560px" /></div>
          </div>
        </div>
      </section>
    </>
  );
}
