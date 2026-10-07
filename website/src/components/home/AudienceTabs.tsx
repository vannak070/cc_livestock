'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Photo } from '@/components/shared/Photo';

interface Tab { key: string; label: string; title: string; body: string; cta: string; href: string; photo: string }

/** "One network, three ways in": Farmer / Investor / Buyer. */
export function AudienceTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find(t => t.key === active) ?? tabs[0];
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls="audience-panel" aria-selected={t.key === tab.key} className="tab" onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div id="audience-panel" role="tabpanel" aria-labelledby={`tab-${tab.key}`} className="tab-panel">
        <div key={tab.key} className="stack rise" style={{ flex: '1 1 420px', minWidth: 0, gap: 14 }}>
          <h3 style={{ fontSize: 30 }}>{tab.title}</h3>
          <p className="lead">{tab.body}</p>
          <Link className="btn btn-green" href={tab.href} style={{ alignSelf: 'flex-start' }}>{tab.cta}</Link>
        </div>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}><Photo id={tab.photo || null} alt="" height={280} /></div>
      </div>
    </div>
  );
}
