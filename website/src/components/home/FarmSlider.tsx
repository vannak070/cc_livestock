'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
export interface MosaicPhoto { src: string; alt: string }

export interface FarmSlide {
  key: string;
  photos: MosaicPhoto[];
  card?: { name: string; place: string; checks: string[]; href: string };
}

const PIN = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EVERY_MS = 6000;

/**
 * The home hero as a slide show of member farms (user, 2026-10-30): each slide is one farm's OWN photos only (three:
 * one large and two small; two: side by side; one: full size) with its record card linking to the farm page. It moves on every 6 s with a soft
 * fade, pauses while pointed at, focused or in a hidden tab, never moves on its own for visitors who ask for reduced
 * motion, and has arrows, dots and swipe. One slide = a still picture (as before). Phones show only the large photo.
 */
export function FarmSlider({ slides, labels }: {
  slides: FarmSlide[];
  labels: { region: string; prev: string; next: string; show: string };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Pictures are fetched for the slides shown so far and the next one, not for every farm at once.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]));
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => {
    const next = (i + count) % count;
    setActive(next);
    setSeen(s => (s.has(next) && s.has((next + 1) % count) ? s : new Set([...s, next, (next + 1) % count])));
  }, [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => { if (!document.hidden) go(active + 1); }, EVERY_MS);
    return () => window.clearInterval(timer);
  }, [active, count, paused, go]);

  if (count === 0) return null;

  return (
    <div
      className="hero-slider rise d3"
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={e => {
        const start = touchX.current;
        touchX.current = null;
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
      }}
    >
      {slides.map((s, si) => (
        <div
          key={s.key}
          className={`hero-mosaic hs-slide${si === active ? ' on' : ''}`}
          data-count={Math.min(s.photos.length, 3)}
          aria-hidden={si !== active}
          aria-roledescription={count > 1 ? 'slide' : undefined}
          inert={si !== active}
        >
          {seen.has(si) && s.photos.slice(0, 3).map((p, i) => (
            <figure key={`${p.src}-${i}`} className={`hm-tile hm-${i}`}>
              <Image
                src={p.src}
                alt={si === active ? p.alt : ''}
                fill
                sizes={i === 0 ? '(max-width: 900px) calc(100vw - 32px), 480px' : '(max-width: 900px) 1px, 220px'}
                preload={si === 0 && i === 0}
                loading={si === 0 && i === 0 ? 'eager' : 'lazy'}
                fetchPriority={si === 0 && i === 0 ? 'high' : 'auto'}
              />
            </figure>
          ))}
          {s.card && (
            <Link className="hm-card" href={s.card.href} tabIndex={si === active ? undefined : -1}>
              <b><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PIN} /></svg>{s.card.name} · {s.card.place}</b>
              {s.card.checks.length > 0 && <span>{s.card.checks.map(c => `✓ ${c}`).join('  ·  ')}</span>}
            </Link>
          )}
        </div>
      ))}
      {count > 1 && (
        <div className="hs-controls">
          <button type="button" className="hs-arrow" aria-label={labels.prev} onClick={() => go(active - 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="hs-dots">
            {slides.map((s, si) => (
              <button
                key={s.key}
                type="button"
                className="hs-dot"
                aria-label={labels.show.replace('{name}', s.card?.name ?? String(si + 1))}
                aria-current={si === active ? 'true' : undefined}
                onClick={() => go(si)}
              />
            ))}
          </div>
          <button type="button" className="hs-arrow" aria-label={labels.next} onClick={() => go(active + 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
