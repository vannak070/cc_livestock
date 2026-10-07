/**
 * The public snapshot published by CC Livestock. This website reads nothing
 * else. Keep these types the same as CC Livestock's
 * src/lib/website/snapshot.ts (PublicSnapshot and friends).
 */
export type BadgeKey = 'feed' | 'weighing' | 'vet';

export interface PublicSummary {
  memberFarms: string;
  provinces: number;
  cattleRaised: string;
  feedRecordedTodayPct: number | null;
}

export interface PublicFarm {
  slug: string;
  publicName: string;
  province: string;
  provinceKm: string;
  district: string;
  lat: number;
  lng: number;
  breeds: string[];
  sizeRange: string;
  memberSince: number | null;
  badges: BadgeKey[];
  hasCattleAvailable: boolean;
  photoIds: string[];
  storyKm: string;
  storyEn: string;
}

export interface PublicListing {
  listingId: string;
  farmSlug: string;
  breed: string;
  sex: string;
  weightClass: string;
  headCount: string;
  province: string;
  provinceKm: string;
  availability: 'now' | 'soon';
  photoId: string | null;
}

export interface PublicNews {
  id: string;
  titleKm: string;
  titleEn: string;
  bodyKm: string;
  bodyEn: string;
  photoId: string | null;
  publishedAt: string;
}

export interface PublicSnapshot {
  version: 1;
  builtAt: string;
  summary: PublicSummary;
  farms: PublicFarm[];
  cattle: PublicListing[];
  news: PublicNews[];
}
