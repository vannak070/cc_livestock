import type { Metadata } from 'next';
import Link from 'next/link';
import { FarmWindows } from '@/components/cattle/FarmWindows';
import { MembersMap } from '@/components/members/MembersMap';
import { ProfileGallery } from '@/components/members/ProfileGallery';
import { PageHead } from '@/components/shared/PageHead';
import { Photo } from '@/components/shared/Photo';
import { NotFoundContent } from '@/components/shared/NotFoundContent';
import { CONTACT } from '@/lib/contact';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';
import { KmWords } from '@/components/shared/KmWords';
import { preconnectMapTiles } from '@/lib/map-tiles';

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { lang } = await pageLang(params);
  const farm = (await getSnapshot()).farms.find(f => f.slug === slug);
  if (!farm) return { robots: { index: false, follow: true } };
  return { title: farm.publicName, description: (lang === 'km' ? farm.storyKm : farm.storyEn) || `${farm.district}, ${lang === 'km' ? farm.provinceKm : farm.province}` };
}

export default async function FarmPage({ params }: { params: Params }) {
  preconnectMapTiles();
  const { slug } = await params;
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  const farm = s.farms.find(f => f.slug === slug);
  // A 404 page cannot be shown inside the per-language root layout (it comes out blank), so a missing
  // one shows the not-found content here, kept out of search engines by generateMetadata.
  if (!farm) return <NotFoundContent />;
  const km = lang === 'km';
  const listings = s.cattle.filter(c => c.farmSlug === slug);
  const others = s.farms.filter(f => f.slug !== slug).slice(0, 3);
  const story = (km ? farm.storyKm : farm.storyEn) || farm.storyKm || farm.storyEn;

  const place = `${farm.district} · ${km ? farm.provinceKm : farm.province}`;
  const askHref = `${href(lang, '/cattle')}${listings[0] ? `?about=${listings[0].listingId}` : ''}#inquiry`;
  const facts: [string, string][] = [
    [t.profile.size, t.values.size[farm.sizeRange] ?? farm.sizeRange],
    [t.profile.breeds, farm.breeds.join(', ') || '—'],
    ...(farm.memberSince ? [[t.profile.memberSinceShort, String(farm.memberSince)] as [string, string]] : []),
  ];

  return (
    <>
      <PageHead
        crumb={{ href: href(lang, '/members'), label: t.profile.back }}
        eyebrow={t.eyebrow.farm}
        title={farm.publicName}
        aside={<ProfileGallery ids={farm.photoIds} alt={farm.publicName} label={t.profile.photos} />}
      >
        <p className="prof-place rise d1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>
          {place}
        </p>
        {(listings.length > 0 || farm.badges.length > 0) && (
          <div className="row" style={{ gap: 8 }}>
            {listings.length > 0 && <span className="pill pill-now">{t.common.availNow}</span>}
            {farm.badges.map(b => <span key={b} className="pill pill-badge">✓ {t.values.badge[b]}</span>)}
          </div>
        )}
        {story && <p className="prof-story">{story}</p>}
        <div className="row" style={{ paddingTop: 4 }}>
          <Link className="btn btn-green" href={askHref}>{t.profile.askCattle} <span aria-hidden="true">→</span></Link>
          <a className="btn btn-line" href={`tel:${CONTACT.phoneTel}`}>{t.common.callUs}</a>
        </div>
      </PageHead>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap stack" style={{ gap: 32 }}>
          <div className="prof-facts">
            {facts.map(([label, value]) => (
              <div key={label}><span>{label}</span><b>{value}</b></div>
            ))}
          </div>
          <div className="split">
            <div className="main stack" style={{ gap: 28 }}>
              <div className="stack" style={{ gap: 14 }}>
                <h2 className="display h3"><KmWords text={t.profile.cattle} /></h2>
                {listings.length === 0 ? <p className="empty">{t.profile.noCattle}</p> : (
                  <div className="card stack" style={{ gap: 14 }}>
                    <FarmWindows windows={listings} t={t} lang={lang} />
                    <p className="small muted" style={{ margin: 0 }}>{t.cattle.vetChecked}</p>
                    <Link className="btn btn-line" style={{ alignSelf: 'flex-start' }} href={`${href(lang, '/cattle')}?about=${listings[0].listingId}#inquiry`}>{t.cattle.askFarm} <span aria-hidden="true">→</span></Link>
                  </div>
                )}
              </div>
              <Link className="btn btn-line" style={{ alignSelf: 'flex-start' }} href={href(lang, '/members')}>← {t.profile.back}</Link>
            </div>
            <aside className="side stack" style={{ gap: 16 }}>
              <div className="card stack" style={{ gap: 12 }}>
                <h2 style={{ fontSize: 20 }}>{t.profile.location}</h2>
                <MembersMap farms={[farm]} selected={farm.slug} note={t.members.pinNote} height={240} />
                <p className="small muted" style={{ margin: 0 }}>{t.profile.locationNote}</p>
              </div>
              <div className="card stack" style={{ gap: 12 }}>
                <h2 style={{ fontSize: 20 }}>{t.profile.contactTitle}</h2>
                <p style={{ color: 'var(--ink-2)', margin: 0 }}>{t.profile.contactBody}</p>
                <a className="btn btn-green" href={`tel:${CONTACT.phoneTel}`}>{t.common.callUs} {CONTACT.phone}</a>
                {CONTACT.telegram && <a className="btn btn-line" href={CONTACT.telegram}>{t.common.telegram}</a>}
              </div>
            </aside>
          </div>
          {others.length > 0 && (
            <div className="stack" style={{ gap: 16 }}>
              <h2 className="display h3"><KmWords text={t.profile.more} /></h2>
              <div className="more-farms">
                {others.map(f => (
                  <Link key={f.slug} href={href(lang, `/members/${f.slug}`)} className="more-farm">
                    <Photo id={f.photoIds[0]} alt="" height={150} size="small" />
                    <b>{f.publicName}</b>
                    <span>{f.district} · {km ? f.provinceKm : f.province}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
