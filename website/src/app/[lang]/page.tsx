import Link from 'next/link';
import { FarmSaleCard } from '@/components/cattle/FarmSaleCard';
import { AudienceTabs } from '@/components/home/AudienceTabs';
import { HomeMap } from '@/components/home/HomeMap';
import { NetworkSection } from '@/components/home/NetworkSection';
import { LiveRecords } from '@/components/home/LiveRecords';
import { OfferPanel } from '@/components/home/OfferPanel';
import { HeroVisual } from '@/components/home/HeroVisual';
import { KmWords } from '@/components/shared/KmWords';
import { markKmWords } from '@/lib/khmer-words';
import { Photo } from '@/components/shared/Photo';
import { Reveal } from '@/components/shared/Reveal';
import { CONTACT } from '@/lib/contact';
import { groupByFarm } from '@/lib/cattle';
import { href } from '@/lib/i18n';
import { showLiveNumbers } from '@/lib/launch';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

/** One simple icon per step of the journey: arrival (tag), feeding (bowl), weighing (scale), ready for sale (tick). */
const STEP_ICONS = [
  'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01',
  'M3 11h18a9 9 0 0 1-18 0z M8 7c0-2 1-3 2-3s2 1 2 3 M14 7c0-2 1-3 2-3',
  'M12 3v18 M5 8h14 M5 8l-3 7a3 3 0 0 0 6 0L5 8z M19 8l-3 7a3 3 0 0 0 6 0l-3-7z',
  'M22 11.1V12a10 10 0 1 1-5.9-9.1 M22 4 12 14l-3-3',
];

/** One icon per standard, in order: feed records, weighing, vet care, traceable animals. */
const STD_ICONS = [
  'M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5',
  'M12 3v3 M5 21h14 M6 21l1-12h10l1 12 M9 13h6',
  'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M12 9v6 M9 12h6',
  'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
];

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  const km = lang === 'km';
  const hasCattle = s.cattle.length > 0;
  // The hero's picture: a member farm's photo (only farms the farmer allowed to show photos have any).
  const heroSlides = s.farms.filter(f => f.photoIds.length > 0).slice(0, 6).map(f => ({ photoId: f.photoIds[0], name: f.publicName, place: km ? f.provinceKm : f.province }));
  const farmHref = Object.fromEntries(s.farms.map(f => [f.slug, href(lang, `/members/${f.slug}`)]));
  // Only numbers that read well: "0% of farms recorded feed today" would look like bad news, so it shows only when most farms did.
  const forSale = new Set(s.cattle.map(c => c.farmSlug)).size;
  const feedPct = s.summary.feedRecordedTodayPct;
  const stats = [
    { value: s.summary.memberFarms, label: t.home.statFarms },
    { value: String(s.summary.provinces), label: t.home.statProvinces },
    { value: s.summary.cattleRaised, label: t.home.statCattle },
    ...(feedPct !== null && feedPct >= 50 ? [{ value: `${feedPct}%`, label: t.home.statFeed }] : forSale > 0 ? [{ value: String(forSale), label: forSale === 1 ? t.home.statForSaleOne : t.home.statForSale }] : []),
  ];

  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-text">
            <span className="kicker rise"><span className="live-dot" aria-hidden="true"><i className="pulse" /><i /></span>{t.home.kicker}</span>
            <h1 className="display h1 rise d1"><span className="h1-line"><KmWords text={t.home.title1} /></span><span className="h1-line"><span className="h1-accent"><KmWords text={t.home.title2} /></span></span></h1>
            <p className="lead rise d3">{t.home.sub}</p>
            <div className="row rise d4" style={{ paddingTop: 6 }}>
              <Link className="btn btn-red" href={href(lang, '/join')}>{t.home.ctaJoin} <span aria-hidden="true">→</span></Link>
              {hasCattle
                ? <Link className="btn btn-line" href={href(lang, '/cattle')}>{t.home.ctaCattle}</Link>
                : <Link className="btn btn-line" href={`${href(lang, '/cattle')}#inquiry`}>{t.home.ctaAsk}</Link>}
            </div>
            <ul className="hero-points rise d4">
              {t.home.offer.map(o => (
                <li key={o.title}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                  {o.title}
                </li>
              ))}
            </ul>
          </div>
          {heroSlides.length > 0 ? (
            <HeroVisual slides={heroSlides} labels={t.home.slideLabels} />
          ) : showLiveNumbers(s.farms.length)
            ? <LiveRecords title={t.home.liveTitle} updated={t.home.liveUpdated} stats={stats} />
            : <OfferPanel title={t.home.offerTitle} items={t.home.offer} note={t.home.offerNote} />}
        </div>
        {heroSlides.length > 0 && showLiveNumbers(s.farms.length) && (
          <div className="wrap hero-strip">
            <LiveRecords compact title={t.home.liveTitle} updated={t.home.liveUpdated} stats={stats} />
          </div>
        )}
      </section>

      <section className="section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2"><KmWords text={t.home.tabsTitle} /></h2>
          {/* Titles are word-marked here on the server, so the client tabs render them the same way. */}
          <AudienceTabs tabs={[
            { key: 'farmer', ...t.home.tabs.farmer, href: href(lang, '/join'), photo: '' },
            { key: 'investor', ...t.home.tabs.investor, href: `${href(lang, '/join')}?role=investor#apply`, photo: '' },
            { key: 'buyer', ...t.home.tabs.buyer, href: href(lang, '/cattle'), photo: '' },
          ].map(tab => ({ ...tab, title: markKmWords(tab.title) }))} />
        </div>
      </section>

      {hasCattle && <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div className="stack" style={{ gap: 6 }}>
              <h2 className="display h2"><KmWords text={t.home.cattleTitle} /></h2>
              <p className="lead">{t.common.priceNote}</p>
            </div>
            <Link className="btn btn-line" href={href(lang, '/cattle')}>{t.common.seeAll}</Link>
          </div>
          {(() => {
            const groups = groupByFarm(s.cattle, s.farms).slice(0, 3);
            return (
              <div className="sale-grid" data-count={groups.length}>
                {groups.map(g => (
                  <FarmSaleCard
                    key={g.farm.slug}
                    group={g}
                    t={t}
                    lang={lang}
                    layout={groups.length === 1 ? 'row' : 'stack'}
                    nameHref={href(lang, `/members/${g.farm.slug}`)}
                    action={<Link className="btn btn-red" href={`${href(lang, '/cattle')}?about=${g.listingId}#inquiry`}>{t.cattle.askFarm} <span aria-hidden="true">→</span></Link>}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </section>}

      <section className="section section-white" id="how" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap stack" style={{ gap: 28 }}>
          <div className="stack" style={{ gap: 8 }}>
            <h2 className="display h2"><KmWords text={t.home.journeyTitle} /></h2>
            <p className="lead">{t.home.journeySub}</p>
          </div>
          <ol className="timeline">
            {t.home.steps.map((step, i) => (
              <li key={step.title} className="t-step">
                <span className="t-badge" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STEP_ICONS[i]} /></svg>
                </span>
                <div className="t-card">
                  <span className="step-no">{km ? `ជំហាន ${'០១២៣៤'[i + 1]}` : `STEP ${i + 1}`}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <span className="t-record"><b>{t.home.recorded}:</b> {step.record}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="t-end">
            <Link className="btn btn-red" href={href(lang, '/join')}>{t.home.journeyCta} <span aria-hidden="true">→</span></Link>
            <span className="small muted">{t.home.journeyCtaNote}</span>
          </div>
        </div>
      </section>

      <section className="section section-mint">
        <div className="wrap split" style={{ alignItems: 'center' }}>
          <div className="side stack" style={{ gap: 16 }}>
            <h2 className="display h2"><KmWords text={t.home.mapTitle} /></h2>
            <p className="lead">{s.farms.length ? t.home.mapSub : t.home.mapSubEmpty}</p>
            {s.farms.length > 0 && <Link className="btn btn-red" href={href(lang, '/members')} style={{ alignSelf: 'flex-start' }}>{t.home.mapCta}</Link>}
          </div>
          <div className="main">
            <HomeMap farms={s.farms} hrefs={farmHref} note={t.members.pinNote} empty={{ title: t.home.mapEmptyTitle, body: t.home.mapEmptyBody, cta: t.home.ctaJoin, href: href(lang, '/join') }} />
          </div>
        </div>
      </section>

      <NetworkSection lang={lang} title={t.home.networkTitle} sub={t.home.networkSub} visit={t.home.networkVisit} farmers={{ tag: t.home.farmersTag, name: t.home.farmersName, role: t.home.farmersRole, cta: t.home.farmersCta, href: href(lang, '/members') }} />

      <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 28 }}>
          <div className="stack" style={{ gap: 10 }}>
            <span className="head-rule" aria-hidden="true" />
            <h2 className="display h2"><KmWords text={t.home.standardsTitle} /></h2>
          </div>
          <Reveal className="std-grid">
            {t.home.standards.map((st, i) => (
              <div key={st.title} className="std-card">
                <span className="std-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STD_ICONS[i % STD_ICONS.length]} /></svg>
                </span>
                <h3>{st.title}</h3>
                <p>{st.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>


      {s.news.length > 0 && (
        <section className="section">
          <div className="wrap stack" style={{ gap: 24 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <h2 className="display h2"><KmWords text={t.home.newsTitle} /></h2>
              <Link className="btn btn-green" href={href(lang, '/news')}>{t.home.allStories}</Link>
            </div>
            <div className="grid">
              {s.news.slice(0, 3).map(n => (
                <Link key={n.id} href={href(lang, `/news/${n.id}`)} className="card lift stack" style={{ gap: 10, textDecoration: 'none', color: 'var(--ink)', background: 'var(--ground)' }}>
                  <Photo id={n.photoId} alt="" height={200} />
                  <span className="small muted">{n.publishedAt.slice(0, 10)}</span>
                  <h3 style={{ fontSize: 20 }}>{km ? n.titleKm : n.titleEn || n.titleKm}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <div className="join-cta join-cta-lg">
            <span className="join-pin" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>
            </span>
            <div className="join-text">
              <h2 className="display"><KmWords text={t.home.joinTitle} /></h2>
              <p>{t.home.joinSub}</p>
              <ul className="join-points">
                {t.home.offer.map(o => (
                  <li key={o.title}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                    {o.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className="join-actions">
              <Link className="btn btn-red" href={href(lang, '/join')}>{t.home.ctaJoin} <span aria-hidden="true">→</span></Link>
              <a className="btn btn-line" href={`tel:${CONTACT.phoneTel}`}>{t.common.callUs} {CONTACT.phone}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
