import type { Metadata } from 'next';
import Link from 'next/link';
import { MembersMap } from '@/components/members/MembersMap';
import { HeroLines } from '@/components/shared/HeroLines';
import { NotFoundContent } from '@/components/shared/NotFoundContent';
import { Photo } from '@/components/shared/Photo';
import { CONTACT } from '@/lib/contact';
import { fill, href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { lang } = await pageLang(params);
  const farm = (await getSnapshot()).farms.find(f => f.slug === slug);
  if (!farm) return { robots: { index: false, follow: true } };
  return { title: farm.publicName, description: (lang === 'km' ? farm.storyKm : farm.storyEn) || `${farm.district}, ${lang === 'km' ? farm.provinceKm : farm.province}` };
}

export default async function FarmPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  const farm = s.farms.find(f => f.slug === slug);
  // A 404 page cannot be shown inside the per-language root layout (it comes out blank), so a missing
  // one shows the not-found content here, kept out of search engines by generateMetadata.
  if (!farm) return <NotFoundContent />;
  const km = lang === 'km';
  const listings = s.cattle.filter(c => c.farmSlug === slug);
  const story = (km ? farm.storyKm : farm.storyEn) || farm.storyKm || farm.storyEn;

  return (
    <>
      <section className="page-head" style={{ paddingTop: 24 }}>
        <HeroLines />
        <div className="wrap stack" style={{ position: 'relative', gap: 20 }}>
          <nav aria-label="Breadcrumb" className="small"><Link href={href(lang, '/members')}>← {t.profile.back}</Link></nav>
          <div className="split" style={{ alignItems: 'center' }}>
            <div className="main rise"><Photo id={farm.photoIds[0]} alt={farm.publicName} height={320} /></div>
            <div className="side stack" style={{ gap: 14 }}>
              {farm.memberSince && <span className="kicker">{fill(t.profile.memberSince, { year: farm.memberSince })}</span>}
              <h1 className="display h2 rise d1">{farm.publicName}</h1>
              <p className="lead">{farm.district} · {km ? farm.provinceKm : farm.province}</p>
              <div className="row" style={{ gap: 8 }}>{farm.badges.map(b => <span key={b} className="pill pill-badge">✓ {t.values.badge[b]}</span>)}</div>
              <div className="row" style={{ paddingTop: 6 }}>
                <Link className="btn btn-red" href={`${href(lang, '/cattle')}${listings[0] ? `?about=${listings[0].listingId}` : ''}#inquiry`}>{t.profile.askCattle}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 48 }}>
        <div className="wrap split">
          <div className="main stack" style={{ gap: 32 }}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="card"><span className="small muted">{t.profile.size}</span><b style={{ display: 'block', fontSize: 22 }}>{t.values.size[farm.sizeRange] ?? farm.sizeRange}</b></div>
              <div className="card"><span className="small muted">{t.profile.breeds}</span><b style={{ display: 'block', fontSize: 22 }}>{farm.breeds.join(', ') || '—'}</b></div>
            </div>
            {story && (
              <div className="stack" style={{ gap: 10 }}>
                <h2 style={{ fontSize: 26 }}>{t.profile.about}</h2>
                <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>{story}</p>
              </div>
            )}
            {farm.photoIds.length > 1 && (
              <div className="stack" style={{ gap: 10 }}>
                <h2 style={{ fontSize: 26 }}>{t.profile.photos}</h2>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {farm.photoIds.slice(1).map(id => <Photo key={id} id={id} alt={farm.publicName} height={170} />)}
                </div>
              </div>
            )}
            <div className="stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 26 }}>{t.profile.cattle}</h2>
              {listings.length === 0 ? <p className="empty">{t.profile.noCattle}</p> : (
                <div className="grid">
                  {listings.map(c => (
                    <div key={c.listingId} className="card lift stack" style={{ gap: 8 }}>
                      <h3 style={{ fontSize: 19 }}>{[c.breed, t.values.sex[c.sex] ?? c.sex].filter(Boolean).join(' · ')}</h3>
                      <p style={{ color: 'var(--ink-2)' }}>{t.values.weight[c.weightClass] ?? c.weightClass} · {t.values.count[c.headCount] ?? c.headCount}</p>
                      <span className={`pill ${c.availability === 'now' ? 'pill-now' : 'pill-soon'}`} style={{ alignSelf: 'flex-start' }}>{c.availability === 'now' ? t.common.availNow : t.common.availSoon}</span>
                      <Link className="btn btn-red" href={`${href(lang, '/cattle')}?about=${c.listingId}#inquiry`}>{t.common.askPrice}</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <aside className="side stack" style={{ gap: 16 }}>
            <div className="card stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 20 }}>{t.profile.location}</h2>
              <MembersMap farms={[farm]} selected={farm.slug} note={t.members.pinNote} height={240} />
              <p className="small muted">{t.profile.locationNote}</p>
            </div>
            <div className="card stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 20 }}>{t.profile.contactTitle}</h2>
              <p style={{ color: 'var(--ink-2)' }}>{t.profile.contactBody}</p>
              <a className="btn btn-red" href={`tel:${CONTACT.phoneTel}`}>{t.common.callUs} {CONTACT.phone}</a>
              {CONTACT.telegram && <a className="btn btn-line" href={CONTACT.telegram}>{t.common.telegram}</a>}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
