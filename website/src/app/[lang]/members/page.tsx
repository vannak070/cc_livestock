import type { Metadata } from 'next';
import Link from 'next/link';
import { MembersExplorer } from '@/components/members/MembersExplorer';
import { PageHead } from '@/components/shared/PageHead';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.members.title, description: t.members.sub };
}

export default async function MembersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  return (
    <>
      <PageHead title={t.members.title} sub={t.members.sub}>
        <div className="row rise d2" style={{ gap: 28 }}>
          <span><b style={{ fontSize: 26, color: 'var(--green-700)' }}>{s.summary.memberFarms}</b> <span className="muted">{t.home.statFarms}</span></span>
          <span><b style={{ fontSize: 26, color: 'var(--green-700)' }}>{s.summary.provinces}</b> <span className="muted">{t.home.statProvinces}</span></span>
        </div>
      </PageHead>
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="wrap stack" style={{ gap: 28 }}>
          {s.farms.length === 0 ? <p className="empty">{t.members.none}</p> : (
            <MembersExplorer
              farms={s.farms}
              lang={lang}
              t={t.members}
              profileHref={Object.fromEntries(s.farms.map(f => [f.slug, href(lang, `/members/${f.slug}`)]))}
              sizeText={t.values.size}
              badgeText={t.values.badge}
              newSince={new Date().getFullYear() - 1}
            />
          )}
          <div className="banner" style={{ padding: '32px 36px' }}>
            <span style={{ fontSize: 20, fontWeight: 600 }}>{t.members.joinBanner}</span>
            <Link className="btn btn-red" href={href(lang, '/join')}>{t.members.joinCta}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
