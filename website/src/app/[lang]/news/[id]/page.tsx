import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Photo } from '@/components/shared/Photo';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

type Params = Promise<{ lang: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const { lang } = await pageLang(params);
  const post = (await getSnapshot()).news.find(n => n.id === id);
  return post ? { title: lang === 'km' ? post.titleKm : post.titleEn || post.titleKm } : {};
}

export default async function NewsPost({ params }: { params: Params }) {
  const { id } = await params;
  const { lang, t } = await pageLang(params);
  const post = (await getSnapshot()).news.find(n => n.id === id);
  if (!post) notFound();
  const km = lang === 'km';
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <article className="wrap stack" style={{ gap: 20, maxWidth: 820 }}>
        <Link href={href(lang, '/news')} className="small">← {t.news.back}</Link>
        <span className="small muted">{post.publishedAt.slice(0, 10)}</span>
        <h1 className="display h2">{km ? post.titleKm : post.titleEn || post.titleKm}</h1>
        {post.photoId && <Photo id={post.photoId} alt="" height={420} />}
        <p style={{ fontSize: 18, lineHeight: 1.8, whiteSpace: 'pre-line', color: 'var(--ink-2)' }}>{km ? post.bodyKm : post.bodyEn || post.bodyKm}</p>
      </article>
    </section>
  );
}
