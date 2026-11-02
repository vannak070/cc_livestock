'use client';

import React, { useEffect, useId, useRef } from 'react';

export interface PageTab { id: string; label: React.ReactNode; icon?: React.ReactNode; badge?: { n: number; tone: 'bad' | 'warn' } }

interface Props {
  tabs: PageTab[];
  active: string;
  onChange: (id: string) => void;
  /** What the tabs choose between, for screen readers. */
  label: string;
  /** The row is only as wide as its tabs (a small choice next to other controls) instead of sharing the whole row. */
  fit?: boolean;
  className?: string;
  /** Ids for the tabs and the panels they open (`<tabPrefix>-<id>`, `<panelPrefix>-<id>`), when a panel points back with aria-labelledby. */
  tabPrefix?: string;
  panelPrefix?: string;
}

/**
 * The one tab bar of the app, in the look of the Reports tabs: a white rounded bar, the open tab filled green with white
 * text, an optional icon and a count badge. Page tabs share the row evenly on a wide screen; four or fewer also share it on
 * a phone; more scroll (without a scrollbar) and the open tab is brought into view. `fit` gives a compact bar for a
 * small choice (Active / Sold / All) that sits beside other controls. Arrow keys move between tabs.
 */
export default function PageTabs({ tabs, active, onChange, label, fit = false, className = '', tabPrefix, panelPrefix }: Props) {
  const uid = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => { refs.current[active]?.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }, [active]);
  const move = (to: number) => {
    const t = tabs[(to + tabs.length) % tabs.length];
    onChange(t.id);
    refs.current[t.id]?.focus();
  };
  const share = !fit && tabs.length <= 4;
  // With icons, a phone puts the icon above a short label so four tabs always fit; without icons the labels just wrap.
  const stacked = share && tabs.some(t => t.icon);
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-w-full shrink-0 ${fit ? 'w-fit' : ''} ${className}`}>
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id} ref={el => { refs.current[t.id] = el; }} type="button" role="tab" id={`${tabPrefix ?? `${uid}-tab`}-${t.id}`} aria-selected={on} aria-controls={panelPrefix ? `${panelPrefix}-${t.id}` : undefined} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => { if (e.key === 'ArrowRight') { e.preventDefault(); move(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i - 1); } }}
            className={`relative flex min-h-12 items-center justify-center rounded-xl text-base font-medium leading-tight transition-colors ${stacked ? 'min-h-14 min-w-0 flex-1 basis-0 flex-col gap-0.5 px-1 py-1.5 text-center text-sm sm:min-h-12 sm:flex-auto sm:basis-auto sm:flex-row sm:gap-2 sm:px-4 sm:text-base' : share ? 'min-w-0 flex-auto gap-2 px-2 text-center sm:px-4' : 'shrink-0 gap-2 whitespace-nowrap px-4 lg:flex-1'} ${on ? 'bg-emerald-700 text-white shadow-sm' : 'text-ink hover:bg-slate-100'}`}>
            {t.icon && <span className={`shrink-0 ${on ? 'text-white' : 'text-emerald-700'}`} aria-hidden>{t.icon}</span>}
            <span className={share ? 'min-w-0 [overflow-wrap:anywhere]' : ''}>{t.label}</span>
            {t.badge && t.badge.n > 0 && (
              <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-sm font-semibold ${stacked ? 'absolute right-1 top-0.5 px-1.5 py-0 text-xs sm:static sm:px-2 sm:py-0.5 sm:text-sm' : ''} ${t.badge.tone === 'bad' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'}`}>{t.badge.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
