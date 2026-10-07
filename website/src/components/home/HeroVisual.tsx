'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { photoUrl } from '@/lib/photo-url';

const PIN = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EVERY_MS = 5000;

export interface HeroSlide { photoId: string; name: string; place: string }

/** The hero's picture: a slideshow of member farms (photos shown with the farmer's consent). Pauses on hover; no autoplay with reduced motion. */
export function HeroVisual({ slides, labels }: { slides: HeroSlide[]; labels: { prev: string; next: string; go: string } }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    if (n < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI(v => (v + 1) % n), EVERY_MS);
    return () => window.clearInterval(id);
  }, [n, paused, i]);

  const go = (to: number) => setI(((to % n) + n) % n);

  return (
    <div
      className="hero-visual rise d3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="hv-photo">
        {slides.map((s, k) => (
          <figure key={s.photoId} className={`hv-slide${k === i ? ' on' : ''}`} aria-hidden={k !== i}>
            <Image src={photoUrl(s.photoId, 'large')} alt={s.name} fill sizes="(max-width: 900px) calc(100vw - 48px), 560px" preload={k === 0} loading={k === 0 ? 'eager' : 'lazy'} />
            <figcaption className="hv-tag">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PIN} /></svg>
              {s.name} · {s.place}
            </figcaption>
          </figure>
        ))}
        {n > 1 && (
          <>
            <button type="button" className="hv-arrow hv-prev" aria-label={labels.prev} onClick={() => go(i - 1)}>‹</button>
            <button type="button" className="hv-arrow hv-next" aria-label={labels.next} onClick={() => go(i + 1)}>›</button>
            <div className="hv-dots">
              {slides.map((s, k) => (
                <button key={s.photoId} type="button" className={k === i ? 'on' : ''} aria-label={`${labels.go} ${k + 1}`} aria-current={k === i} onClick={() => go(k)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
