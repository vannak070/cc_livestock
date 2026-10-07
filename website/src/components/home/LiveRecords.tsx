'use client';

import { useEffect, useRef, useState } from 'react';

interface Stat { value: string; label: string }

/** Splits "1,200+" into 1200 and "+", so the number can count up. */
const parse = (v: string) => {
  const m = /^([\d,]+)(.*)$/.exec(v);
  return m ? { n: Number(m[1].replace(/,/g, '')), suffix: m[2] } : null;
};

/**
 * "Live from our records": the network's rounded numbers. They are in the page
 * itself (so link previews, search engines and slow phones see the real values).
 * Numbers that start below the fold count up once when scrolled into view;
 * numbers already on screen, or with reduced motion, are simply shown.
 */
export function LiveRecords({ title, updated, stats, compact }: { title: string; updated: string; stats: Stat[]; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const box = el.getBoundingClientRect();
    const onScreen = box.top < window.innerHeight && box.bottom > 0;
    // Already on screen, in a hidden tab (nothing to watch), or reduced motion: just show the numbers.
    if (onScreen || window.innerHeight === 0 || document.visibilityState === 'hidden' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Below the fold: hide the final values until they scroll into view, then count up.
    frame = requestAnimationFrame(() => setP(0));
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const step = (t: number) => {
        const x = Math.min(1, (t - start) / 1600);
        setP(1 - Math.pow(1 - x, 3));
        if (x < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div ref={ref} className={`live${compact ? ' live-compact' : ' rise d3'}`} aria-live="off">
      <div className="live-head">
        <span>{title}</span>
        <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--green-700)', fontWeight: 500 }}>
          <span className="live-dot" aria-hidden="true"><i className="pulse" /><i /></span>{updated}
        </span>
      </div>
      <div className="live-grid">
        {stats.map(s => {
          const parsed = parse(s.value);
          const shown = parsed ? `${Math.round(parsed.n * p).toLocaleString('en-US')}${parsed.suffix}` : s.value;
          return (
            <div key={s.label} className="tile">
              <b aria-label={s.value}>{shown}</b>
              <span className="small muted">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
