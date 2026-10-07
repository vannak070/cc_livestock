'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
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
 * Leaflet is loaded in the browser only.
 */
export function MembersMap({ farms, selected, onSelect, note, height = 440 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then(L => {
      if (cancelled || !box.current || map.current) return;
      map.current = L.map(box.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView(CAMBODIA_CENTRE, 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 12,
        minZoom: 6,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw the pins whenever the farms or the selection change.
  useEffect(() => {
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
  }, [farms, selected]);

  return (
    <div className="map-box" style={{ height }}>
      <div ref={box} style={{ height: '100%', width: '100%' }} />
      <span className="map-note">{note}</span>
    </div>
  );
}
