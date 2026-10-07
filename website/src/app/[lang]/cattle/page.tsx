import type { Metadata } from 'next';
import { CattleExplorer } from '@/components/cattle/CattleExplorer';
import { PageHead } from '@/components/shared/PageHead';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.cattle.title, description: t.cattle.sub };
}

export default async function CattlePage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ about?: string }> }) {
  const { lang, t } = await pageLang(params);
  const { about } = await searchParams;
  const s = await getSnapshot();
  return (
    <>
      <PageHead title={t.cattle.title} sub={t.cattle.sub} />
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="wrap">
          <CattleExplorer
            cattle={s.cattle}
            farms={s.farms}
            t={{ cattle: t.cattle, inquiry: t.inquiry, common: t.common, values: t.values }}
            lang={lang}
            initialAbout={typeof about === 'string' ? about : ''}
          />
        </div>
      </section>
    </>
  );
}
