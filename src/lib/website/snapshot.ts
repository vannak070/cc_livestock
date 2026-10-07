import type { BatchItem, FarmItem, FeedStockTransaction, HealthLogItem, WebsiteBatchListing, WebsiteConsent, WebsiteFarmProfile, WebsiteNewsPost } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { activeCattle } from '../attention';
import { farmMatcher } from '../farm-scope';
import { badgesFor, type BadgeKey } from './badges';
import { farmWindows } from './listing';
import { provinceOf } from './places';
import { farmSlug, farmSizeRange, percentTo5, publicCode, publicPin, roundedTotal } from './rounding';
import { currentConsent } from './validation';
import { feedDayStatus } from '../daily-feed';

/**
 * The public snapshot: everything the website may show, and nothing else
 * (SFD sections 4 and 5). Built from approved records by pure rules, then
 * checked against PUBLIC_FIELDS. The website and the public API read only
 * this; they never touch the CC Livestock database.
 */

export interface PublicSummary {
  memberFarms: string;
  provinces: number;
  cattleRaised: string;
  /** Share of member farms that recorded feed today, rounded to 5; null with no farms. */
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
 * Cattle for sale, one entry per farm and time window ("now", "soon"). No
 * breed, sex, photo or individual animal: only a rounded head count and a
 * weight range of whole classes.
 */
export interface PublicListing {
  /** The code of the FARM ("l-xxxxxx"); the price form carries it so the office knows which farm was asked about. */
  listingId: string;
  farmSlug: string;
  /** "Under 10", "10+", "20+" or "50+". */
  headCount: string;
  /** Lower edge of the smallest weight class in kg; null = no lower limit ("Under 250 kg"). */
  weightFrom: number | null;
  /** Upper edge of the largest weight class in kg; null = no upper limit ("400 kg+"). */
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

/** The allow-list: the only fields each public object may carry. */
export const PUBLIC_FIELDS = {
  snapshot: ['version', 'builtAt', 'summary', 'farms', 'cattle', 'news'],
  summary: ['memberFarms', 'provinces', 'cattleRaised', 'feedRecordedTodayPct'],
  farm: ['slug', 'publicName', 'province', 'provinceKm', 'district', 'lat', 'lng', 'breeds', 'sizeRange', 'memberSince', 'badges', 'hasCattleAvailable', 'photoIds', 'storyKm', 'storyEn'],
  listing: ['listingId', 'farmSlug', 'headCount', 'weightFrom', 'weightTo', 'province', 'provinceKm', 'availability'],
  news: ['id', 'titleKm', 'titleEn', 'bodyKm', 'bodyEn', 'photoId', 'publishedAt'],
} as const;

/** Every field that is not on the allow-list, as "farm.price"-style paths. Empty means safe. */
export function fieldsOutsideAllowList(snapshot: PublicSnapshot): string[] {
  const extra = (obj: object, allowed: readonly string[], path: string) =>
    Object.keys(obj).filter(k => !allowed.includes(k)).map(k => `${path}.${k}`);
  return [
    ...extra(snapshot, PUBLIC_FIELDS.snapshot, 'snapshot'),
    ...extra(snapshot.summary, PUBLIC_FIELDS.summary, 'summary'),
    ...snapshot.farms.flatMap(f => extra(f, PUBLIC_FIELDS.farm, 'farm')),
    ...snapshot.cattle.flatMap(l => extra(l, PUBLIC_FIELDS.listing, 'listing')),
    ...snapshot.news.flatMap(n => extra(n, PUBLIC_FIELDS.news, 'news')),
  ];
}

/** The public code for a farm's cattle for sale; price inquiries carry it so the office can find the farm. */
export const farmListingIdOf = (farmId: string): string => `l-${publicCode(farmId)}`;

/** The older public code, for a batch. Inquiries sent before cattle were shown by farm still carry it. */
export const listingIdOf = (batchId: string): string => `l-${publicCode(batchId)}`;

export interface SnapshotInput {
  farms: Pick<FarmItem, 'id' | 'name'>[];
  profiles: WebsiteFarmProfile[];
  consents: WebsiteConsent[];
  listings: WebsiteBatchListing[];
  news: WebsiteNewsPost[];
  stock: StockItem[];
  weights: WeightRecord[];
  batches: BatchItem[];
  feedTransactions: FeedStockTransaction[];
  healthLogs: HealthLogItem[];
  saleWindow: number;
  /** YYYY-MM-DD, farm time. */
  today: string;
  builtAt: string;
}

export function buildPublicSnapshot(input: SnapshotInput): PublicSnapshot {
  const farms: PublicFarm[] = [];
  const cattle: PublicListing[] = [];
  let cattleRaised = 0;
  let recordedToday = 0;

  const profiles = [...input.profiles].sort((a, b) => a.publicName.localeCompare(b.publicName));
  for (const profile of profiles) {
    const farm = input.farms.find(f => f.id === profile.farmId);
    const consent = currentConsent(input.consents, profile.farmId);
    const province = provinceOf(profile.province);
    if (!profile.published || !farm || !consent || !consent.mayShowName || !province) continue;

    const onFarm = farmMatcher(farm.name);
    const farmStock = input.stock.filter(c => onFarm(c.location));
    const active = activeCattle(farmStock);
    const batches = input.batches.filter(b => b.status === 'Active' && onFarm(b.farmLocation));
    const slug = farmSlug(profile.publicName, profile.farmId);

    // What this farm has for sale, from its batches' sell schedule (one entry per time window).
    const listed: PublicListing[] = farmWindows(batches, input.listings, input.stock, input.weights, input.today, input.saleWindow).map(w => ({
      listingId: farmListingIdOf(profile.farmId),
      farmSlug: slug,
      headCount: w.headCount,
      weightFrom: w.weightFrom,
      weightTo: w.weightTo,
      province: province.key,
      provinceKm: province.km,
      availability: w.availability,
    }));

    const pin = publicPin(profile.mapLat ?? province.lat, profile.mapLng ?? province.lng, consent.mayShowExactLocation);
    const breeds = [...new Set(active.map(c => c.breed.trim()).filter(Boolean))].sort().slice(0, 3);
    farms.push({
      slug,
      publicName: profile.publicName.trim(),
      province: province.key,
      provinceKm: province.km,
      district: profile.district.trim(),
      lat: pin.lat,
      lng: pin.lng,
      breeds,
      sizeRange: farmSizeRange(active.length),
      memberSince: profile.memberSince ?? null,
      badges: badgesFor({ cattle: active, batches, weights: input.weights, feedTransactions: input.feedTransactions, healthLogs: input.healthLogs, today: input.today }),
      hasCattleAvailable: listed.length > 0,
      photoIds: consent.mayShowPhotos ? profile.photoIds : [],
      storyKm: profile.storyKm.trim(),
      storyEn: profile.storyEn.trim(),
    });
    cattle.push(...listed);
    cattleRaised += farmStock.length;
    const status = feedDayStatus(input.feedTransactions, batches.map(b => b.id), input.today);
    if (status === 'recorded' || status === 'partly') recordedToday++;
  }

  const news: PublicNews[] = input.news
    .filter(n => n.published && n.publishedAt)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .map(n => ({ id: n.id, titleKm: n.titleKm, titleEn: n.titleEn, bodyKm: n.bodyKm, bodyEn: n.bodyEn, photoId: n.photoId ?? null, publishedAt: n.publishedAt! }));

  return {
    version: 1,
    builtAt: input.builtAt,
    summary: {
      memberFarms: roundedTotal(farms.length, 5),
      provinces: new Set(farms.map(f => f.province)).size,
      cattleRaised: roundedTotal(cattleRaised, 100),
      feedRecordedTodayPct: percentTo5(recordedToday, farms.length),
    },
    farms,
    cattle: cattle.sort((a, b) => (a.availability === b.availability ? 0 : a.availability === 'now' ? -1 : 1) || a.province.localeCompare(b.province)),
    news,
  };
}
