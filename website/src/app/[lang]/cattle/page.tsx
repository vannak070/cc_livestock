import type { Metadata } from 'next';
import { CattleExplorer } from '@/components/cattle/CattleExplorer';
import { PageHead } from '@/components/shared/PageHead';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';
import { siteImages } from '@/lib/site-images';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.cattle.title, description: t.cattle.sub };
}

export default async function CattlePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const s = await getSnapshot();
  const img = await siteImages();
  return (
    <>
      <PageHead eyebrow={t.eyebrow.cattle} title={t.cattle.title} sub={t.cattle.sub} photo={img['farm-feeding']} />
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="wrap">
          <CattleExplorer
            cattle={s.cattle}
            farms={s.farms}
            t={{ cattle: t.cattle, contact: t.contact, common: t.common, values: t.values }}
            lang={lang}
            stale={s.stale}
          />
        </div>
      </section>
    </>
  );
}
