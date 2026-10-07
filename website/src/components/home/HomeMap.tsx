'use client';

import { useRouter } from 'next/navigation';
import { MembersMap, type MapFarm } from '@/components/members/MembersMap';

/** The home page's map: tapping a pin opens that farm's profile. */
export function HomeMap({ farms, hrefs, note }: { farms: MapFarm[]; hrefs: Record<string, string>; note: string }) {
  const router = useRouter();
  return <MembersMap farms={farms} note={note} onSelect={slug => router.push(hrefs[slug])} />;
}
