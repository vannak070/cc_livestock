'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Photo } from '@/components/shared/Photo';
import { KmWords } from '@/components/shared/KmWords';

interface Tab { key: string; label: string; title: string; body: string; cta: string; href: string; photo: string; points: readonly string[] }

const ICONS: Record<string, string> = {
  farmer: 'M12 22V12 M12 12c0-4 3-7 8-7 0 4-3 7-8 7z M12 14c0-3-2.5-5-7-5 0 3 2.5 5 7 5z',
  investor: 'M3 3v18h18 M7 15l4-4 3 3 5-6',
  buyer: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
};

const Icon = ({ k, size = 22 }: { k: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[k] ?? ICONS.farmer} /></svg>
);

/** "One network, three ways in": Farmer / Investor / Buyer. */
export function AudienceTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find(t => t.key === active) ?? tabs[0];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="aud-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls="audience-panel" aria-selected={t.key === tab.key} className="aud-tab" onClick={() => setActive(t.key)}>
            <Icon k={t.key} />
            {t.label}
          </button>
        ))}
      </div>
      <div id="audience-panel" role="tabpanel" aria-labelledby={`tab-${tab.key}`} className="aud-panel">
        <div key={tab.key} className="aud-text rise">
          <span className="aud-badge"><Icon k={tab.key} size={30} /></span>
          <h3 className="display"><KmWords text={tab.title} /></h3>
          <p className="lead">{tab.body}</p>
          <Link className="btn btn-green" href={tab.href}>{tab.cta} <span aria-hidden="true">→</span></Link>
        </div>
        <div className="aud-side">
          {tab.photo ? <Photo id={tab.photo} alt="" height={280} /> : (
            <ul key={tab.key} className="aud-points rise">
              {tab.points.map((p, i) => (
                <li key={p}>
                  <span className="aud-n">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
