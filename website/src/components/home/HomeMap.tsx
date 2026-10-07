'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MembersMap, type MapFarm } from '@/components/members/MembersMap';

/**
 * The home page's map: tapping a pin opens that farm's profile. With no farms
 * yet (`empty` given), an invitation to join sits on the map instead.
 */
export function HomeMap({ farms, hrefs, note, empty, height }: {
  farms: MapFarm[];
  hrefs: Record<string, string>;
  note: string;
  empty?: { title: string; body: string; cta: string; href: string };
  height?: number;
}) {
  const router = useRouter();
  return (
    <div style={{ position: 'relative' }}>
      <MembersMap farms={farms} note={note} height={height} onSelect={slug => router.push(hrefs[slug])} />
      {empty && farms.length === 0 && (
        <div className="map-invite">
          <b>{empty.title}</b>
          <span>{empty.body}</span>
          <Link className="btn btn-red" href={empty.href}>{empty.cta}</Link>
        </div>
      )}
    </div>
  );
}
