import { Fragment } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { InquiryForm } from '@/components/cattle/InquiryForm';
import { ApplicationForm } from '@/components/join/ApplicationForm';
import { JoinRoles } from '@/components/join/JoinRoles';
import { PageHead } from '@/components/shared/PageHead';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.join.pageTitle, description: t.join.pageSub };
}

const Tick = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
);

const ICONS = {
  farmer: 'M12 22V12 M12 12c0-4 3-7 8-7 0 4-3 7-8 7z M12 14c0-3-2.5-5-7-5 0 3 2.5 5 7 5z',
  buyer: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  investor: 'M3 3v18h18 M7 15l4-4 3 3 5-6',
};

export default async function JoinPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ role?: string }> }) {
  const { lang, t } = await pageLang(params);
  const { role = 'farmer' } = await searchParams;
  const tabs = t.home.tabs;
  const ticks = (items: readonly string[]) => (
    <ul className="jn-get">
      {items.map(i => <li key={i}><span className="jn-tick"><Tick /></span>{i}</li>)}
    </ul>
  );
  // Elements passed inside the roles list need keys (React warns otherwise).
  const about = (key: string, title: string, body: string, items: readonly string[], more?: { to: string; label: string }) => (
    <div key={key} className="stack" style={{ gap: 14 }}>
      <h2 className="display h3">{title}</h2>
      <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 17 }}>{body}</p>
      {ticks(items)}
      {more && <Link className="btn btn-line" href={more.to} style={{ alignSelf: 'flex-start' }}>{more.label}</Link>}
    </div>
  );
  const farmerInfo = (
    <Fragment key="farmer-info">
      <div className="stack" style={{ gap: 14 }}>
        <h2 className="display h3">{t.join.getTitle}</h2>
        {ticks(t.join.get)}
      </div>
      <div className="stack" style={{ gap: 14 }}>
        <h2 className="display h3">{t.join.stepsTitle}</h2>
        <ol className="jn-steps">
          {t.join.steps.map(i => <li key={i}>{i}</li>)}
        </ol>
      </div>
      <div className="jn-look">
        <h2>{t.join.lookTitle}</h2>
        <ul>
          {t.join.look.map(i => <li key={i}>{i}</li>)}
        </ul>
      </div>
    </Fragment>
  );
  return (
    <>
      <PageHead title={t.join.pageTitle} sub={t.join.pageSub} />
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <JoinRoles
            title={t.join.chooseTitle}
            initial={role}
            roles={[
              { key: 'farmer', label: tabs.farmer.label, blurb: tabs.farmer.title, icon: ICONS.farmer, info: farmerInfo, formTitle: t.join.formTitle,
                form: <ApplicationForm key="farmer-form" t={{ join: t.join, common: t.common }} lang={lang} membersHref={href(lang, '/members')} /> },
              { key: 'buyer', label: tabs.buyer.label, blurb: tabs.buyer.title, icon: ICONS.buyer,
                info: about('buyer-info', tabs.buyer.title, tabs.buyer.body, tabs.buyer.points, { to: href(lang, '/cattle'), label: tabs.buyer.cta }),
                formTitle: t.inquiry.title,
                form: <InquiryForm key="buyer-form" t={{ inquiry: t.inquiry, common: t.common, values: t.values }} lang={lang} listings={[]} /> },
              { key: 'investor', label: tabs.investor.label, blurb: tabs.investor.title, icon: ICONS.investor,
                info: about('investor-info', tabs.investor.title, tabs.investor.body, tabs.investor.points),
                formTitle: t.inquiry.investorTitle,
                form: <InquiryForm key="investor-form" t={{ inquiry: t.inquiry, common: t.common, values: t.values }} lang={lang} listings={[]} investor /> },
            ]}
          />
        </div>
      </section>
    </>
  );
}
