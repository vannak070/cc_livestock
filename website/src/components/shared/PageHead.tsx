import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { KmWords } from './KmWords';

/**
 * The top of every inner page (the home page has its own hero): a small green label, a large navy title with a thin
 * rule beside it, one line under it, optional extras below (children) and, on the right, either a card (aside) or a
 * farm photo (photo; on phones a short photo strip above the title). Use sharp photos (the stand or team photos).
 * photo can also be a ready-made picture block (the farm page's gallery), which gets the same place and phone strip.
 */
export function PageHead({ eyebrow, title, sub, aside, photo, crumb, children }: {
  eyebrow?: string;
  title: string;
  sub?: string;
  aside?: ReactNode;
  photo?: string | ReactNode;
  crumb?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <section className="page-head">
      <div className={`wrap ph-in${aside || photo ? '' : ' ph-solo'}${photo && !aside ? ' ph-with-photo' : ''}`}>
        <div className="ph-text">
          {crumb && <nav aria-label="Breadcrumb" className="crumb ph-crumb"><Link href={crumb.href}>← {crumb.label}</Link></nav>}
          {eyebrow && <span className="ph-eyebrow rise">{eyebrow}</span>}
          <h1 className="display rise d1"><KmWords text={title} /></h1>
          {sub && <p className="lead rise d2">{sub}</p>}
          {children}
        </div>
        {aside
          ? <aside className="ph-aside rise d2">{aside}</aside>
          : typeof photo === 'string'
            ? (
              <figure className="ph-photo rise d2">
                <Image src={photo} alt="" fill sizes="(max-width: 900px) calc(100vw - 48px), 500px" preload />
              </figure>
            )
            : photo && <div className="ph-media rise d2">{photo}</div>}
      </div>
    </section>
  );
}
