import type { Metadata } from 'next';
import { ApplicationForm } from '@/components/join/ApplicationForm';
import { PageHead } from '@/components/shared/PageHead';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.join.title, description: t.join.sub };
}

export default async function JoinPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const list = (title: string, items: string[], ordered = false) => {
    const L = ordered ? 'ol' : 'ul';
    return (
      <div className="stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 26 }}>{title}</h2>
        <L style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 17, color: 'var(--ink-2)' }}>
          {items.map(i => <li key={i}>{i}</li>)}
        </L>
      </div>
    );
  };
  return (
    <>
      <PageHead title={t.join.title} sub={t.join.sub}>
        <a className="btn btn-red rise d2" href="#apply" style={{ alignSelf: 'flex-start' }}>{t.join.applyNow}</a>
      </PageHead>
      <section className="section" style={{ paddingTop: 44 }}>
        <div className="wrap split">
          <div className="side stack" style={{ gap: 28 }}>
            {list(t.join.getTitle, t.join.get)}
            {list(t.join.lookTitle, t.join.look)}
            {list(t.join.stepsTitle, t.join.steps, true)}
          </div>
          <div className="main" id="apply" style={{ scrollMarginTop: 96 }}>
            <div className="card form-card stack" style={{ gap: 16 }}>
              <h2 style={{ fontSize: 24 }}>{t.join.formTitle}</h2>
              <ApplicationForm t={{ join: t.join, common: t.common }} lang={lang} membersHref={href(lang, '/members')} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
