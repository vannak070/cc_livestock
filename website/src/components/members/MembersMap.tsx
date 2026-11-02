'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';

export interface MapFarm {
  slug: string;
  publicName: string;
  district: string;
  lat: number;
  lng: number;
}

interface Props {
  farms: MapFarm[];
  selected?: string | null;
  onSelect?: (slug: string) => void;
  /** Note shown on the map, e.g. "Pins show the district, not the exact farm". */
  note: string;
  height?: number;
}

const CAMBODIA_CENTRE: [number, number] = [12.5, 104.9];

/**
 * The Farmer Members map: OpenStreetMap tiles, one red pin per member farm,
 * placed at district level (the snapshot already blurred the position).
 * Leaflet (script and style) is loaded in the browser only, and only once the map is about to scroll into view,
 * so it does not slow down the first paint of the page.
 */
export function MembersMap({ farms, selected, onSelect, note, height = 440 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  /** True once the map exists, so the pins are drawn only after that (the script loads late). */
  const [ready, setReady] = useState(false);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Wait until the map is close to the screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { const t = window.setTimeout(() => setNear(true), 0); return () => window.clearTimeout(t); }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '150px' });
    io.observe(el);
    // Some browsers (in-app browsers, a tab opened in the background) never report it: start anyway when it is on screen.
    const t = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight + 150 && r.bottom > -150) { setNear(true); io.disconnect(); }
    }, 1200);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (cancelled || !box.current || map.current) return;
      map.current = L.map(box.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView(CAMBODIA_CENTRE, 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 12,
        minZoom: 6,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, [near]);

  // Draw the pins whenever the farms or the selection change.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import('leaflet').then(L => {
      const m = map.current;
      if (cancelled || !m) return;
      markers.current.forEach(mk => mk.remove());
      markers.current = farms.map((f, i) => {
        const on = f.slug === selected;
        const icon = L.divIcon({ className: '', html: `<div class="pin${on ? ' on' : ''}" style="animation-delay:${0.15 * i}s"></div>`, iconSize: on ? [30, 30] : [22, 22], iconAnchor: on ? [15, 15] : [11, 11] });
        const mk = L.marker([f.lat, f.lng], { icon, title: `${f.publicName}, ${f.district}`, keyboard: true, riseOnHover: true }).addTo(m);
        mk.on('click', () => onSelectRef.current?.(f.slug));
        return mk;
      });
      if (selected) {
        const f = farms.find(x => x.slug === selected);
        if (f) m.panTo([f.lat, f.lng]);
      } else if (farms.length > 0) {
        m.fitBounds(L.latLngBounds(farms.map(f => [f.lat, f.lng] as [number, number])).pad(0.4), { maxZoom: 9 });
      }
    });
    return () => { cancelled = true; };
  }, [farms, selected, ready]);

  return (
    <div ref={wrap} className="map-box" style={{ height }}>
      <div ref={box} style={{ height: '100%', width: '100%' }} />
      <span className="map-note">{note}</span>
    </div>
  );
}
