'use client';

import React from 'react';

/** One report section: a titled card (the page shows one section at a time; the whole report downloads from the top). */
export function SectionFrame({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={`rep-panel-${id}`} role="tabpanel" aria-labelledby={`rep-tab-${id}`} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 gap-3">
          <span className="mt-1 inline-block h-7 w-1.5 shrink-0 rounded-sm" style={{ background: '#B32C33' }} aria-hidden />
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-ink">{title}</h2>
            <p className="max-w-3xl text-base text-ink-muted">{subtitle}</p>
          </div>
        </div>
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}
