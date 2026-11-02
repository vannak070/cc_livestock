import React from 'react';

/**
 * Building blocks of the printed report (a financial-report look): a branded page header, numbered sections, KPI cards with a
 * coloured edge, tables with right-aligned numbers, a totals row and negatives in brackets, simple SVG bar charts, status pills.
 * White page, logo red (#B32C33) for titles and warnings, logo green (#138E46) for good news, Kantumruy Pro throughout.
 * Sheets are drawn off-screen and printed by src/lib/print-sheet.ts.
 */
export const BRAND_RED = '#B32C33';
export const BRAND_GREEN = '#138E46';
export const BRAND_GREEN_DARK = '#0B5E2E';
export const BRAND_SOFT = '#F1F8F3';
const INK = '#1f2937';
const MUTE = '#64748b';
const LINE = '#e2e8f0';
const AMBER = '#D9822B';

/** 1,234,567; negatives in brackets, the way a financial statement writes them. */
export const fmt = (n: number) => (n < 0 ? `(${Math.abs(Math.round(n)).toLocaleString('en-US')})` : Math.round(n).toLocaleString('en-US'));
/** Millions with one decimal, for the cards: 2,772.2 M. */
export const mil = (n: number) => `${n < 0 ? '−' : ''}${(Math.abs(n) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
export const pct = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('en-US')}%`;

type Tone = 'good' | 'bad' | 'warn' | undefined;
const toneColor = (t: Tone) => (t === 'good' ? BRAND_GREEN : t === 'bad' ? BRAND_RED : t === 'warn' ? AMBER : INK);

/** The page header every section starts with: logo and name on the left, the report and its scope on the right. */
export function PageHeader({ title, scope }: { title: string; scope: string }) {
  return (
    <header className="pdf-block" style={{ borderBottom: `3px solid ${BRAND_RED}`, paddingBottom: 10, marginBottom: 18 }}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-2026.png" alt="" width={46} height={46} style={{ width: 46, height: 46, objectFit: 'contain' }} />
        <div className="min-w-0">
          <p className="text-[22px] font-bold leading-tight" lang="km" style={{ color: INK }}>ខេម ខោវ</p>
          <p className="text-[12px] font-semibold tracking-wide" style={{ color: BRAND_GREEN_DARK }}>CamCow</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[17px] font-bold" style={{ color: BRAND_RED }}>{title}</p>
          <p className="text-[12px]" style={{ color: MUTE }}>{scope}</p>
        </div>
      </div>
    </header>
  );
}

/** The cover block of a report: title, scope and when it was prepared. */
export function Cover({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="pdf-block" style={{ marginBottom: 20 }}>
      <h1 className="text-[34px] font-bold leading-tight" style={{ color: INK }}>{title}</h1>
      <div className="mt-3 grid gap-0" style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)`, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        {rows.map(([k, v], i) => (
          <div key={k} className="px-4 py-3" style={{ borderLeft: i === 0 ? 'none' : `1px solid ${LINE}` }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: MUTE }}>{k}</p>
            <p className="text-[16px] font-bold" style={{ color: INK }}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A numbered section: starts on a new page (except the first), a header band, a title and what it shows. */
export function Section({ no, title, note, header, children, first }: { no: number; title: string; note?: string; header?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <section className={first ? '' : 'pdf-break'} style={{ marginTop: first ? 0 : 0 }}>
      {header}
      <div className="pdf-block" style={{ marginBottom: 14 }}>
        <h2 className="flex items-baseline gap-3 text-[24px] font-bold" style={{ color: INK }}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[15px] text-white" style={{ background: BRAND_RED }}>{no}</span>
          {title}
        </h2>
        {note && <p className="mt-1 text-[12.5px]" style={{ color: MUTE }}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** A small heading inside a section. */
export function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="pdf-block mb-2 mt-5 text-[14px] font-bold uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK, breakAfter: 'avoid' }}>{children}</h3>;
}

export interface Kpi { label: string; value: string; sub?: string; tone?: Tone }

/** A row of figure cards, each with a coloured top edge (red for a problem, green for good news, amber for watch). */
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="pdf-block grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, minmax(0, 1fr))` }}>
      {items.map(k => (
        <div key={k.label} className="rounded-md bg-white px-4 py-3" style={{ border: `1px solid ${LINE}`, borderTop: `4px solid ${k.tone ? toneColor(k.tone) : '#cbd5e1'}` }}>
          <p className="text-[10.5px] font-semibold uppercase leading-snug tracking-wider" style={{ color: MUTE }}>{k.label}</p>
          <p className="mt-1 text-[25px] font-bold leading-tight tabular-nums" style={{ color: toneColor(k.tone) }}>{k.value}</p>
          {k.sub && <p className="mt-0.5 text-[11.5px]" style={{ color: MUTE }}>{k.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export interface Col<T> {
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  cell: (row: T) => React.ReactNode;
  /** The cell of the totals row. */
  total?: React.ReactNode;
  tone?: (row: T) => Tone;
  /** Draw the value in bold. */
  bold?: boolean;
  /** Keep the value on one line (months, dates). */
  nowrap?: boolean;
}

/** A table: small grey header, thin rules, right-aligned numbers, an optional totals row, an optional highlighted row. */
export function DataTable<T>({ cols, rows, totals, highlight, empty }: { cols: Col<T>[]; rows: T[]; totals?: boolean; highlight?: (row: T) => boolean; empty?: string }) {
  const align = (c: Col<T>) => c.align ?? 'left';
  if (rows.length === 0 && empty) return <p className="pdf-block py-3 text-[12.5px]" style={{ color: MUTE }}>{empty}</p>;
  return (
    <table className="w-full border-collapse text-[12.5px] tabular-nums" style={{ color: INK }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${INK}` }}>
          {cols.map((c, i) => <th key={i} className="px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-wider" style={{ textAlign: align(c), color: MUTE, width: c.width }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="pdf-block" style={{ borderBottom: `1px solid ${LINE}`, background: highlight?.(r) ? BRAND_SOFT : ri % 2 === 1 ? '#fafbfc' : undefined }}>
            {cols.map((c, ci) => <td key={ci} className="px-2.5 py-1.5" style={{ textAlign: align(c), color: toneColor(c.tone?.(r)), fontWeight: c.bold || ci === 0 ? 600 : 400, whiteSpace: c.nowrap ? 'nowrap' : undefined }}>{c.cell(r)}</td>)}
          </tr>
        ))}
        {totals && rows.length > 0 && (
          <tr className="pdf-block" style={{ borderTop: `2px solid ${INK}`, background: '#f1f5f9' }}>
            {cols.map((c, ci) => <td key={ci} className="px-2.5 py-2 font-bold" style={{ textAlign: align(c) }}>{c.total ?? ''}</td>)}
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** A status pill: RED / AMBER / GREEN. */
export function Pill({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'none'; children: React.ReactNode }) {
  const bg = tone === 'good' ? BRAND_GREEN : tone === 'bad' ? BRAND_RED : tone === 'warn' ? AMBER : '#94a3b8';
  return <span className="inline-block rounded px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white" style={{ background: bg }}>{children}</span>;
}

/** Key messages: a few plain sentences that say what the figures mean. */
export function Messages({ title, items }: { title: string; items: { text: string; tone?: Tone }[] }) {
  return (
    <div className="pdf-block rounded-md px-5 py-4" style={{ background: BRAND_SOFT, border: `1px solid #cfe6d8` }}>
      <p className="mb-2 text-[13px] font-bold uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK }}>{title}</p>
      <ul className="space-y-1.5 text-[14px]" style={{ color: INK }}>
        {items.map((m, i) => (
          <li key={i} className="flex gap-2"><span aria-hidden style={{ color: toneColor(m.tone), fontWeight: 700 }}>■</span><span>{m.text}</span></li>
        ))}
      </ul>
    </div>
  );
}

export interface Series { name: string; color: string; values: number[] }

/** A grouped bar chart drawn as SVG: gridlines, month labels, a legend, values on the axis in millions when `unit` is 'M'. */
export function BarChart({ title, categories, series, unit = 'M', height = 230 }: { title: string; categories: string[]; series: Series[]; unit?: 'M' | ''; height?: number }) {
  const W = 700, H = height, left = 52, right = 8, top = 14, bottom = 46;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const step = niceStep(max / 4);
  const top4 = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top4 / step) + 1 }, (_, i) => i * step);
  const plotH = H - top - bottom;
  const slot = (W - left - right) / Math.max(1, categories.length);
  const barW = Math.min(26, (slot - 8) / series.length);
  const y = (v: number) => top + plotH - (v / top4) * plotH;
  const label = (v: number) => (unit === 'M' ? (v === 0 ? '0' : `${Math.round(v / 1_000_000).toLocaleString('en-US')}M`) : v.toLocaleString('en-US'));
  return (
    <figure className="pdf-block rounded-md p-3" style={{ border: `1px solid ${LINE}` }}>
      <figcaption className="mb-1 text-[13px] font-bold" style={{ color: INK }}>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#94a3b8' : '#e2e8f0'} />
            <text x={left - 6} y={y(t) + 4} fontSize="10.5" textAnchor="end" fill={MUTE}>{label(t)}</text>
          </g>
        ))}
        {categories.map((c, i) => {
          const x0 = left + i * slot + (slot - barW * series.length) / 2;
          return (
            <g key={c + i}>
              {series.map((s, k) => <rect key={s.name} x={x0 + k * barW} y={y(s.values[i] ?? 0)} width={barW - 2} height={Math.max(0, top + plotH - y(s.values[i] ?? 0))} fill={s.color} rx="1.5" />)}
              <text x={left + i * slot + slot / 2} y={H - bottom + 16} fontSize="10.5" textAnchor="middle" fill={MUTE}>{c}</text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <p className="mt-1 flex flex-wrap justify-center gap-4 text-[11.5px]" style={{ color: MUTE }}>
          {series.map(s => <span key={s.name} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
        </p>
      )}
    </figure>
  );
}

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** Shares as horizontal bars (breed, sex, health). */
export function ShareBars({ title, rows }: { title: string; rows: { label: string; count: number; pct: number }[] }) {
  return (
    <div className="pdf-block rounded-md p-3" style={{ border: `1px solid ${LINE}` }}>
      <p className="mb-2 text-[13px] font-bold" style={{ color: INK }}>{title}</p>
      {rows.length === 0 ? <p className="text-[12px]" style={{ color: MUTE }}>—</p> : rows.slice(0, 6).map(r => (
        <div key={r.label} className="flex items-center gap-2 py-0.5 text-[12px]">
          <span className="w-32 shrink-0 truncate">{r.label}</span>
          <span className="h-3 flex-1 rounded-sm" style={{ background: '#eef2f6' }}><span className="block h-full rounded-sm" style={{ width: `${Math.max(2, r.pct)}%`, background: BRAND_GREEN }} /></span>
          <span className="w-20 shrink-0 text-right tabular-nums">{r.count} · {r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="pdf-block mt-4 text-[11.5px] italic leading-relaxed" style={{ color: MUTE }}>{children}</p>;
}
