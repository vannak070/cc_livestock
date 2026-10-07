import Image from 'next/image';
import Link from 'next/link';
import { shownPartners } from '@/lib/partners';
import type { Lang } from '@/lib/i18n';
import { KmWords } from '@/components/shared/KmWords';

/** "Our network": the organisations around the farms, and the farmers themselves as the last card. */
export function NetworkSection({ lang, title, sub, farmers, visit }: {
  lang: Lang;
  title: string;
  sub: string;
  farmers: { tag: string; name: string; role: string; cta: string; href: string };
  visit: string;
}) {
  const partners = shownPartners();
  if (partners.length === 0) return null;
  return (
    <section className="section">
      <div className="wrap stack" style={{ gap: 32 }}>
        <div className="stack" style={{ gap: 10, maxWidth: 680 }}>
          <span className="head-rule" aria-hidden="true" />
          <h2 className="display h2"><KmWords text={title} /></h2>
          <p className="lead" style={{ margin: 0 }}>{sub}</p>
        </div>
        <div className="net-grid">
          {partners.map(p => {
            const inner = (
              <>
                <span className="net-tag">{p.tag[lang]}</span>
                <span className="net-logo"><Image src={p.logo} alt="" width={104} height={104} style={{ width: '100%', height: '100%' }} /></span>
                <h3>{p.name[lang]}</h3>
                <p>{p.role[lang]}</p>
                {p.link && <span className="net-visit">{visit} <span aria-hidden="true">↗</span></span>}
              </>
            );
            const cls = `net-card${p.key === 'camcow' ? ' net-us' : ''}`;
            return p.link
              ? <a key={p.key} className={`${cls} net-link`} href={p.link} target="_blank" rel="noopener noreferrer" aria-label={p.name[lang]}>{inner}</a>
              : <article key={p.key} className={cls}>{inner}</article>;
          })}
          <article className="net-card net-farmers">
            <span className="net-tag">{farmers.tag}</span>
            <span className="net-logo net-sprout" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V12 M12 12c0-4 3-7 8-7 0 4-3 7-8 7z M12 14c0-3-2.5-5-7-5 0 3 2.5 5 7 5z" /></svg>
            </span>
            <h3>{farmers.name}</h3>
            <p>{farmers.role}</p>
            <Link className="net-visit" href={farmers.href}>{farmers.cta} <span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </div>
    </section>
  );
}
