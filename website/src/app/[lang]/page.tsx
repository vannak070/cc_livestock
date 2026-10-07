import Link from 'next/link';
import { AudienceTabs } from '@/components/home/AudienceTabs';
import { HomeMap } from '@/components/home/HomeMap';
import { LiveRecords } from '@/components/home/LiveRecords';
import { OfferPanel } from '@/components/home/OfferPanel';
import { HeroLines } from '@/components/shared/HeroLines';
import { Photo } from '@/components/shared/Photo';
import { Reveal } from '@/components/shared/Reveal';
import { href } from '@/lib/i18n';
import { showLiveNumbers } from '@/lib/launch';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  const km = lang === 'km';
  const provinces = [...new Set(s.farms.map(f => (km ? f.provinceKm : f.province)))];
  const hasCattle = s.cattle.length > 0;
  const farmHref = Object.fromEntries(s.farms.map(f => [f.slug, href(lang, `/members/${f.slug}`)]));
  const stats = [
    { value: s.summary.memberFarms, label: t.home.statFarms },
    { value: String(s.summary.provinces), label: t.home.statProvinces },
    { value: s.summary.cattleRaised, label: t.home.statCattle },
    { value: s.summary.feedRecordedTodayPct === null ? '—' : `${s.summary.feedRecordedTodayPct}%`, label: t.home.statFeed },
  ];

  return (
    <>
      <section className="hero">
        <HeroLines />
        <div className="wrap hero-in">
          <div className="hero-text">
            <span className="kicker rise"><span className="live-dot" aria-hidden="true"><i className="pulse" /><i /></span>{t.home.kicker}</span>
            <h1 className="display h1 rise d1">{t.home.title1}<br />{t.home.title2}</h1>
            <p className="lead rise d3">{t.home.sub}</p>
            <div className="row rise d4" style={{ paddingTop: 6 }}>
              <Link className="btn btn-red" href={href(lang, '/join')}>{t.home.ctaJoin} <span aria-hidden="true">→</span></Link>
              {hasCattle
                ? <Link className="btn btn-line" href={href(lang, '/cattle')}>{t.home.ctaCattle}</Link>
                : <Link className="btn btn-line" href={`${href(lang, '/cattle')}#inquiry`}>{t.home.ctaAsk}</Link>}
            </div>
          </div>
          {showLiveNumbers(s.farms.length)
            ? <LiveRecords title={t.home.liveTitle} updated={t.home.liveUpdated} stats={stats} />
            : <OfferPanel title={t.home.offerTitle} items={t.home.offer} note={t.home.offerNote} />}
        </div>
      </section>

      {provinces.length > 0 && (
        <section className="ticker" aria-label={t.home.mapTitle}>
          <div className="ticker-track">
            {[0, 1].map(copy => provinces.concat(provinces.length < 4 ? provinces : []).map((p, i) => (
              <span key={`${copy}-${i}`} aria-hidden={copy === 1}>{p} <span className="dot">•</span></span>
            )))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{t.home.tabsTitle}</h2>
          <AudienceTabs tabs={[
            { key: 'farmer', ...t.home.tabs.farmer, href: href(lang, '/join'), photo: '' },
            { key: 'investor', ...t.home.tabs.investor, href: href(lang, '/contact'), photo: '' },
            { key: 'buyer', ...t.home.tabs.buyer, href: href(lang, '/cattle'), photo: '' },
          ]} />
        </div>
      </section>

      <section className="section section-white" id="how" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap stack" style={{ gap: 28 }}>
          <div className="stack" style={{ gap: 8 }}>
            <h2 className="display h2">{t.home.journeyTitle}</h2>
            <p className="lead">{t.home.journeySub}</p>
          </div>
          <div className="journey" aria-hidden="true">
            <svg viewBox="0 0 1100 260" preserveAspectRatio="none"><path className="draw" d="M40 210 C 220 200, 300 150, 470 130 S 760 70, 1060 30" fill="none" stroke="#138e46" strokeWidth="4" strokeLinecap="round" /></svg>
            <span className="traveller" />
          </div>
          <ol className="grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {t.home.steps.map((step, i) => (
              <li key={step.title} className="card lift stack" style={{ gap: 8, background: 'var(--ground)' }}>
                <span className="step-no">{km ? `ជំហាន ${'០១២៣៤'[i + 1]}` : `STEP ${i + 1}`}</span>
                <h3 style={{ fontSize: 21 }}>{step.title}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-mint">
        <div className="wrap split" style={{ alignItems: 'center' }}>
          <div className="side stack" style={{ gap: 16 }}>
            <h2 className="display h2">{t.home.mapTitle}</h2>
            <p className="lead">{s.farms.length ? t.home.mapSub : t.home.mapSubEmpty}</p>
            {s.farms.length > 0 && <Link className="btn btn-red" href={href(lang, '/members')} style={{ alignSelf: 'flex-start' }}>{t.home.mapCta}</Link>}
          </div>
          <div className="main">
            <HomeMap farms={s.farms} hrefs={farmHref} note={t.members.pinNote} empty={{ title: t.home.mapEmptyTitle, body: t.home.mapEmptyBody, cta: t.home.ctaJoin, href: href(lang, '/join') }} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{t.home.standardsTitle}</h2>
          <Reveal className="grid">
            {t.home.standards.map(st => (
              <div key={st.title} className="card lift stack" style={{ gap: 8 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0e6b34" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                <h3 style={{ fontSize: 19 }}>{st.title}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{st.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {hasCattle && <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div className="stack" style={{ gap: 6 }}>
              <h2 className="display h2">{t.home.cattleTitle}</h2>
              <p className="lead">{t.common.priceNote}</p>
            </div>
            <Link className="btn btn-line" href={href(lang, '/cattle')}>{t.common.seeAll}</Link>
          </div>
          <div className="grid">
            {s.cattle.slice(0, 3).map(c => (
              <article key={c.listingId} className="card lift stack" style={{ gap: 10 }}>
                <Photo id={c.photoId} alt={c.breed} height={160} />
                <h3 style={{ fontSize: 19 }}>{[c.breed, t.values.sex[c.sex] ?? c.sex].filter(Boolean).join(' · ')}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{t.values.weight[c.weightClass] ?? c.weightClass} · {t.values.count[c.headCount] ?? c.headCount} · {km ? c.provinceKm : c.province}</p>
                <span className={`pill ${c.availability === 'now' ? 'pill-now' : 'pill-soon'}`} style={{ alignSelf: 'flex-start' }}>{c.availability === 'now' ? t.common.availNow : t.common.availSoon}</span>
                <Link className="btn btn-red" href={`${href(lang, '/cattle')}?about=${c.listingId}#inquiry`}>{t.common.askPrice}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>}

      {s.news.length > 0 && (
        <section className="section">
          <div className="wrap stack" style={{ gap: 24 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <h2 className="display h2">{t.home.newsTitle}</h2>
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

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="banner">
            <svg width="220" height="160" viewBox="0 0 220 160" aria-hidden="true" style={{ position: 'absolute', right: 24, bottom: -10, opacity: 0.3 }}>
              {['M30 160 C 30 110, 20 80, 40 40', 'M80 160 C 82 100, 70 70, 95 20', 'M130 160 C 128 115, 140 80, 120 45', 'M180 160 C 180 105, 190 75, 175 30'].map(d => (
                <path key={d} className="sway" d={d} fill="none" stroke="#0a4424" strokeWidth="5" strokeLinecap="round" />
              ))}
            </svg>
            <div className="stack" style={{ position: 'relative', flex: '1 1 520px', gap: 10 }}>
              <h2 className="display h2">{t.home.joinTitle}</h2>
              <p style={{ fontSize: 19 }}>{t.home.joinSub}</p>
            </div>
            <Link className="btn btn-red" href={href(lang, '/join')} style={{ position: 'relative' }}>{t.home.ctaJoin}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
