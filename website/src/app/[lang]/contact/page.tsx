import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead } from '@/components/shared/PageHead';
import { ABOUT } from '@/lib/about';
import { CONTACT } from '@/lib/contact';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.contact.title, description: t.contact.sub };
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  return (
    <>
      <PageHead title={t.contact.title} sub={t.contact.sub} />
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap grid">
          <div className="card stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 20 }}>{t.common.phone}</h2>
            <a className="btn btn-red" href={`tel:${CONTACT.phoneTel}`} style={{ alignSelf: 'flex-start' }}>{CONTACT.phone}</a>
          </div>
          <div className="card stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 20 }}>{t.common.facebook}</h2>
            <a className="btn btn-line" href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start' }}>ខេម ខោវ Cam Cow</a>
          </div>
          <div className="card stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 20 }}>{t.contact.office}</h2>
            <p style={{ color: 'var(--ink-2)' }}>{ABOUT.address || t.contact.officeText}</p>
            {ABOUT.hours && <p style={{ color: 'var(--ink-2)' }}>{ABOUT.hours}</p>}
            <Link href={href(lang, '/cattle') + '#inquiry'}>{t.inquiry.title} →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
