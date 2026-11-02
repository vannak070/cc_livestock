import Image from 'next/image';
import Link from 'next/link';
import { HowTimeline } from '@/components/home/HowTimeline';
import { FarmSaleCard } from '@/components/cattle/FarmSaleCard';
import { FarmSlider, type FarmSlide, type MosaicPhoto } from '@/components/home/FarmSlider';
import { HomeMap } from '@/components/home/HomeMap';
import { NetworkSection } from '@/components/home/NetworkSection';
import { LiveRecords } from '@/components/home/LiveRecords';
import { PathCards } from '@/components/home/PathCards';
import { KmWords } from '@/components/shared/KmWords';
import { Photo } from '@/components/shared/Photo';
import { SectionHead } from '@/components/shared/SectionHead';
import { groupByFarm } from '@/lib/cattle';
import { href } from '@/lib/i18n';
import { showLiveNumbers } from '@/lib/launch';
import { pageLang } from '@/lib/page';
import { photoUrl } from '@/lib/photo-url';
import { getSnapshot } from '@/lib/snapshot/read';
import { preconnectMapTiles } from '@/lib/map-tiles';
import { siteImages } from '@/lib/site-images';

/** The three farm photos from the printed stands (replaceable in the office); they fill in wherever member farms have not shared enough photos. */
const STAND_SLOTS = ['farm-feeding', 'farm-grazing', 'farm-shed'] as const;

/**
 * Home: hero (headline and buttons, farm photo mosaic with a record card; the "Working with" partner line was removed
 * 10-27 at the user's request, partners stay in the network section) and the numbers bar, the three ways in as
 * photo cards, cattle available, how it works beside a photo, the network with the map and stories (the closing
 * photo band was removed 10-27 at the user's request; the hero already has the Join button). Every photo of a member farm is one the farmer allowed to show.
 */
export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  preconnectMapTiles();
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  const img = await siteImages();
  const km = lang === 'km';
  const hasCattle = s.cattle.length > 0;
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

  // Photos: one per member farm that shares photos, then the stand photos.
  const withPhotos = s.farms.filter(f => f.photoIds.length > 0);
  const farmPhotos: MosaicPhoto[] = withPhotos.map(f => ({ src: photoUrl(f.photoIds[0], 'large'), alt: f.publicName }));
  const standPhotos: MosaicPhoto[] = STAND_SLOTS.map((slot, i) => ({ src: img[slot], alt: t.stand.farmPhotos[i] ?? '' }));
  // The hero slide show (user 10-30: "image update from farm only"): one slide per member farm that shares photos,
  // showing ONLY that farm's own uploaded photos (1 to 3, the layout adapts), at most six farms. Only when no farm has
  // shared a photo yet does it show one still slide of the stand photos, without a farm card.
  const slides: FarmSlide[] = withPhotos.length
    ? withPhotos.slice(0, 6).map(f => ({
      key: f.slug,
      photos: f.photoIds.slice(0, 3).map(id => ({ src: photoUrl(id, 'large'), alt: f.publicName })),
      card: { name: f.publicName, place: km ? f.provinceKm : f.province, checks: f.badges.slice(0, 2).map(b => t.values.badge[b] ?? b), href: farmHref[f.slug] },
    }))
    : [{ key: 'stand', photos: standPhotos }];
  const pick = (i: number, fallback: string) => farmPhotos[i]?.src ?? fallback;

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
          </div>
          <FarmSlider slides={slides} labels={{ region: t.home.sliderLabel, prev: t.home.sliderPrev, next: t.home.sliderNext, show: t.home.sliderShow }} />
        </div>
        {showLiveNumbers(s.farms.length) && (
          <div className="wrap hero-strip">
            <LiveRecords compact title={t.home.liveTitle} updated={t.home.liveUpdated} stats={stats} />
          </div>
        )}
      </section>

      <section className="section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <SectionHead title={t.home.tabsTitle} />
          <PathCards items={[
            { key: 'farmer', ...t.home.tabs.farmer, href: href(lang, '/join'), photo: img['farm-shed'] },
            { key: 'buyer', ...t.home.tabs.buyer, href: href(lang, '/cattle'), photo: pick(1, img['farm-feeding']) },
            { key: 'investor', ...t.home.tabs.investor, href: `${href(lang, '/join')}?role=investor#apply`, photo: img['farm-grazing'] },
          ]} />
        </div>
      </section>

      {hasCattle && <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <SectionHead title={t.home.cattleTitle} intro={t.common.priceNote} />
            <Link className="btn btn-line" href={href(lang, '/cattle')}>{t.common.seeAll}</Link>
          </div>
          {(() => {
            const groups = groupByFarm(s.cattle, s.farms).slice(0, 3);
            return (
              <div className="sale-grid home-sale" data-count={groups.length}>
                {groups.map(g => (
                  <FarmSaleCard
                    key={g.farm.slug}
                    group={g}
                    t={t}
                    lang={lang}
                    layout={groups.length === 1 ? 'row' : 'stack'}
                    nameHref={href(lang, `/members/${g.farm.slug}`)}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </section>}

      <section className="section" id="how">
        <div className="wrap journey">
          <div className="journey-side">
            <SectionHead title={t.home.journeyTitle} intro={t.home.journeySub} />
            <figure className="journey-photo">
              <Image src={pick(2, img['farm-feeding'])} alt="" fill sizes="(max-width: 960px) calc(100vw - 32px), 460px" />
            </figure>
            <div className="t-end">
              <Link className="btn btn-line" href={href(lang, '/for-farmers')}>{t.farmers.title} <span aria-hidden="true">→</span></Link>
              <span className="small muted">{t.home.journeyCtaNote}</span>
            </div>
          </div>
          <HowTimeline t={t} lang={lang} vertical />
        </div>
      </section>

      <NetworkSection
        lang={lang}
        title={t.home.networkTitle}
        sub={t.home.networkSub}
        visit={t.home.networkVisit}
        farmers={{ tag: t.home.farmersTag, name: t.home.farmersName, role: t.home.farmersRole, cta: t.home.farmersCta, href: href(lang, '/members') }}
        map={
          <>
            <HomeMap farms={s.farms} hrefs={farmHref} note={t.members.pinNote} empty={{ title: t.home.mapEmptyTitle, body: t.home.mapEmptyBody, cta: t.home.ctaJoin, href: href(lang, '/join') }} />
            <div className="net-map-foot">
              <span className="small muted">{s.farms.length ? t.home.mapSub : t.home.mapSubEmpty}</span>
              {s.farms.length > 0 && <Link className="btn btn-line" href={href(lang, '/members')}>{t.home.mapCta}</Link>}
            </div>
          </>
        }
      />

      {s.news.length > 0 && (
        <section className="section">
          <div className="wrap stack" style={{ gap: 24 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <SectionHead title={t.home.newsTitle} />
              <Link className="btn btn-line" href={href(lang, '/news')}>{t.home.allStories}</Link>
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

    </>
  );
}
