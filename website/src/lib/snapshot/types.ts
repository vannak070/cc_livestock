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

/**
 * Cattle for sale, one entry per farm and time window ("now", "soon"): only a
 * rounded head count and a weight range of whole classes. (Keep the same as
 * CC Livestock's src/lib/website/snapshot.ts.)
 */
export interface PublicListing {
  /** The code of the farm; the price form carries it so the office knows which farm was asked about. */
  listingId: string;
  farmSlug: string;
  /** "Under 10", "10+", "20+" or "50+". */
  headCount: string;
  /** Lower edge of the smallest weight class in kg; null = no lower limit. */
  weightFrom: number | null;
  /** Upper edge of the largest weight class in kg; null = no upper limit. */
  weightTo: number | null;
  province: string;
  provinceKm: string;
  availability: 'now' | 'soon';
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
