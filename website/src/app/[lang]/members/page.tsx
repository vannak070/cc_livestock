import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeMap } from '@/components/home/HomeMap';
import { MembersExplorer } from '@/components/members/MembersExplorer';
import { PageHead } from '@/components/shared/PageHead';
import { href } from '@/lib/i18n';
import { showLiveNumbers } from '@/lib/launch';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';
import { KmWords } from '@/components/shared/KmWords';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.members.title, description: t.members.sub };
}

export default async function MembersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  return (
    <>
      <PageHead
        eyebrow={t.eyebrow.members}
        title={t.members.title}
        sub={s.farms.length ? t.members.sub : t.home.mapSubEmpty}
        aside={showLiveNumbers(s.farms.length) ? (
          <div className="ph-card">
            <dl className="ph-stats">
              <div><dt>{t.home.statFarms}</dt><dd>{s.summary.memberFarms}</dd></div>
              <div><dt>{t.home.statProvinces}</dt><dd>{s.summary.provinces}</dd></div>
              {s.farms.some(f => f.hasCattleAvailable) && <div><dt>{t.members.cattleAvailable}</dt><dd>{s.farms.filter(f => f.hasCattleAvailable).length}</dd></div>}
            </dl>
          </div>
        ) : undefined}
      />
      <section className="section" style={{ paddingTop: 36 }}>
        <div className="wrap stack" style={{ gap: 28 }}>
          {s.farms.length === 0 ? (
            <HomeMap farms={[]} hrefs={{}} note={t.members.pinNote} height={480} empty={{ title: t.home.mapEmptyTitle, body: t.home.mapEmptyBody, cta: t.members.joinCta, href: href(lang, '/join') }} />
          ) : (
            <MembersExplorer
              farms={s.farms}
              lang={lang}
              t={t.members}
              profileHref={Object.fromEntries(s.farms.map(f => [f.slug, href(lang, `/members/${f.slug}`)]))}
              sizeText={t.values.size}
              badgeText={t.values.badge}
            />
          )}
          {s.farms.length > 0 && (
            <div className="join-cta">
              <span className="join-pin" aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>
              </span>
              <div className="join-text">
                <h2 className="display"><KmWords text={t.members.joinBanner} /></h2>
                <p>{t.home.mapEmptyBody}</p>
                <ul className="join-points">
                  {t.home.offer.map(o => (
                    <li key={o.title}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                      {o.title}
                    </li>
                  ))}
                </ul>
              </div>
              <Link className="btn btn-red" href={href(lang, '/join')}>{t.members.joinCta} <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
