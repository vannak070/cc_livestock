'use client';

import { useEffect, useRef, useState } from 'react';

interface Stat { value: string; label: string }

/** Splits "1,200+" into 1200 and "+", so the number can count up. */
const parse = (v: string) => {
  const m = /^([\d,]+)(.*)$/.exec(v);
  return m ? { n: Number(m[1].replace(/,/g, '')), suffix: m[2] } : null;
};

/**
 * "Live from our records": the network's rounded numbers, counting up when
 * they come into view. With reduced motion they show straight away.
 */
export function LiveRecords({ title, updated, stats }: { title: string; updated: string; stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = requestAnimationFrame(() => setP(1));
      return () => cancelAnimationFrame(frame);
    }
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
    <div ref={ref} className="live rise d3" aria-live="off">
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
