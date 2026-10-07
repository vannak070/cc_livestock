import Link from 'next/link';
import type { ReactNode } from 'react';
import { KmWords } from './KmWords';

/**
 * The top of every inner page (the home page has its own hero): a small
 * green label, a large serif title with the red rule beside it, one line
 * under it, optional extras below (children) and an optional card on the
 * right (aside). One look everywhere; About set the style.
 */
export function PageHead({ eyebrow, title, sub, aside, crumb, children }: {
  eyebrow?: string;
  title: string;
  sub?: string;
  aside?: ReactNode;
  crumb?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <section className="page-head">
      <div className={`wrap ph-in${aside ? '' : ' ph-solo'}`}>
        <div className="ph-text">
          {crumb && <nav aria-label="Breadcrumb" className="crumb ph-crumb"><Link href={crumb.href}>← {crumb.label}</Link></nav>}
          {eyebrow && <span className="ph-eyebrow rise">{eyebrow}</span>}
          <h1 className="display rise d1"><KmWords text={title} /></h1>
          {sub && <p className="lead rise d2">{sub}</p>}
          {children}
        </div>
        {aside && <aside className="ph-aside rise d2">{aside}</aside>}
      </div>
    </section>
  );
}
