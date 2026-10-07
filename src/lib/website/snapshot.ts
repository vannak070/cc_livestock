import type { BatchItem, FarmItem, FeedStockTransaction, HealthLogItem, WebsiteBatchListing, WebsiteConsent, WebsiteFarmProfile, WebsiteNewsPost } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { activeCattle } from '../attention';
import { farmMatcher } from '../farm-scope';
import { badgesFor, type BadgeKey } from './badges';
import { listingFacts } from './listing';
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

/** The allow-list: the only fields each public object may carry. */
export const PUBLIC_FIELDS = {
  snapshot: ['version', 'builtAt', 'summary', 'farms', 'cattle', 'news'],
  summary: ['memberFarms', 'provinces', 'cattleRaised', 'feedRecordedTodayPct'],
  farm: ['slug', 'publicName', 'province', 'provinceKm', 'district', 'lat', 'lng', 'breeds', 'sizeRange', 'memberSince', 'badges', 'hasCattleAvailable', 'photoIds', 'storyKm', 'storyEn'],
  listing: ['listingId', 'farmSlug', 'breed', 'sex', 'weightClass', 'headCount', 'province', 'provinceKm', 'availability', 'photoId'],
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

/** The public code for a batch listing; inquiries carry it so the office can find the batch. */
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

    const listed: PublicListing[] = [];
    for (const batch of batches) {
      const listing = input.listings.find(l => l.batchId === batch.id && l.published);
      if (!listing) continue;
      const facts = listingFacts(batch, listing, input.stock, input.weights, input.today, input.saleWindow);
      if (!facts.availability || !facts.weightClass || !facts.headCount) continue;
      listed.push({
        listingId: listingIdOf(batch.id),
        farmSlug: slug,
        breed: facts.breed,
        sex: facts.sex,
        weightClass: facts.weightClass,
        headCount: facts.headCount,
        province: province.key,
        provinceKm: province.km,
        availability: facts.availability,
        photoId: consent.mayShowPhotos ? listing.photoId ?? null : null,
      });
    }

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
