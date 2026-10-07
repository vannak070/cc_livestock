import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead } from '@/components/shared/PageHead';
import { Photo } from '@/components/shared/Photo';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.news.title };
}

export default async function NewsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const { news } = await getSnapshot();
  return (
    <>
      <PageHead eyebrow={t.eyebrow.news} title={t.news.title} />
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          {news.length === 0 ? <p className="empty">{t.news.none}</p> : (
            <div className="grid">
              {news.map(n => (
                <Link key={n.id} href={href(lang, `/news/${n.id}`)} className="card lift stack" style={{ gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
                  <Photo id={n.photoId} alt="" height={200} />
                  <span className="small muted">{n.publishedAt.slice(0, 10)}</span>
                  <h2 style={{ fontSize: 20 }}>{lang === 'km' ? n.titleKm : n.titleEn || n.titleKm}</h2>
                  <span className="small" style={{ color: 'var(--green-700)', fontWeight: 600 }}>{t.news.readMore} →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
