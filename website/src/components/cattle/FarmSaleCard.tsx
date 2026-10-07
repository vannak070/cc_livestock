import Link from 'next/link';
import type { ReactNode } from 'react';
import { Photo } from '@/components/shared/Photo';
import type { FarmCattle } from '@/lib/cattle';
import type { Dict } from '@/lib/i18n';
import { FarmWindows } from './FarmWindows';

const PIN = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

/**
 * One farm's cattle for sale: its photo, name and place, when it is available
 * with a rounded count and weight range, and an action (ask about it).
 * layout "row" is a wide feature card for a single farm; "stack" is a card for a grid.
 */
export function FarmSaleCard({ group, t, lang, action, layout = 'stack', nameHref, selected, priority = false }: {
  /** Load the photo straight away (the first card on the page). */
  priority?: boolean;
  group: FarmCattle;
  t: Pick<Dict, 'cattle' | 'common' | 'values'>;
  lang: 'km' | 'en';
  action: ReactNode;
  layout?: 'row' | 'stack';
  nameHref?: string;
  selected?: boolean;
}) {
  const { farm, windows } = group;
  return (
    <article className={`sale-card lift${layout === 'row' ? ' sale-row' : ''}`} style={selected ? { boxShadow: '0 0 0 3px var(--green)' } : undefined}>
      <div className="sale-photo"><Photo id={farm.photoIds[0]} alt={farm.publicName} height={220} size="large" priority={priority} /></div>
      <div className="sale-body">
        <div className="stack" style={{ gap: 6 }}>
          <h3 className="sale-name">{nameHref ? <Link href={nameHref}>{farm.publicName}</Link> : farm.publicName}</h3>
          <p className="sale-where">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PIN} /></svg>
            {farm.district} · {lang === 'km' ? farm.provinceKm : farm.province}
          </p>
        </div>
        <FarmWindows windows={windows} t={t} lang={lang} />
        <p className="sale-note"><span aria-hidden="true">✓</span> {t.cattle.vetChecked}</p>
        <div className="sale-action">{action}</div>
      </div>
    </article>
  );
}
