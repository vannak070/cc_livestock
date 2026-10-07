'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Pages that already end with their own "join" banner or form, or (Contact) are all about reaching us, or (Cattle) are
 * for buyers: a farmer's "Raise cattle with CamCow" band would repeat them or be for the wrong visitor.
 */
const HAS_OWN_JOIN = ['/', '/members', '/join', '/about', '/contact', '/cattle'];

/** The footer's "Raise cattle with CamCow" band, left out where the page already asks the same. */
export function FooterBand({ title, sub, joinHref, joinLabel }: { title: string; sub: string; joinHref: string; joinLabel: string }) {
  const rest = (usePathname() || '/').replace(/^\/(km|en)/, '') || '/';
  if (HAS_OWN_JOIN.includes(rest) || rest.startsWith('/members/')) return null; // a farm's page has its own questions to ask
  return (
    <div className="wrap">
      <div className="footer-cta">
        <div className="stack" style={{ gap: 6, flex: '1 1 320px' }}>
          <b className="footer-cta-title">{title}</b>
          <span style={{ color: 'var(--ink-2)' }}>{sub}</span>
        </div>
        <Link className="btn btn-red" href={joinHref}>{joinLabel}</Link>
      </div>
    </div>
  );
}
