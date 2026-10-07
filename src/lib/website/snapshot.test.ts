import { describe, expect, it } from 'vitest';
import type { BatchItem, WebsiteBatchListing, WebsiteConsent, WebsiteFarmProfile, WebsiteNewsPost } from '../types';
import type { StockItem, WeightRecord } from '../xlsx-parser';
import { buildPublicSnapshot, farmListingIdOf, fieldsOutsideAllowList, type SnapshotInput } from './snapshot';

const TODAY = '2026-10-07';
// Confidential values that must never appear on the website.
const SECRET = { price: 12345, phone: '012999888', owner: 'Owner Secret Name', seller: 'Seller Secret', cowId: 'COW-SECRET-1', batchId: 'BATCH-SECRET', farmId: 'FARM-SECRET', exactKg: 412.37 };

const cow = (id: string, extra: Partial<StockItem> = {}) => ({
  id, no: '1', breed: 'Brahman cross', sex: 'Male', age: '2', weight: 300, ownerName: SECRET.seller, location: 'SNR Farm', phone: SECRET.phone,
  buyType: 'Buy', unitPrice: SECRET.price, totalPrice: SECRET.price, healthStatus: 'Good', status: 'Active', purchaseDate: '2026-06-01', remark: 'confidential note', ...extra,
}) as StockItem;

const profile = (extra: Partial<WebsiteFarmProfile> = {}): WebsiteFarmProfile => ({
  farmId: SECRET.farmId, publicName: 'Green Hill Farm', province: 'Kandal', district: 'Kien Svay', mapLat: 11.4567, mapLng: 104.9876,
  storyKm: 'រឿង', storyEn: 'Story', memberSince: 2025, photoIds: ['p1'], published: true, updatedBy: 'x', updatedAt: 'x', ...extra,
});
const consent = (extra: Partial<WebsiteConsent> = {}): WebsiteConsent => ({
  id: 'c1', farmId: SECRET.farmId, givenByName: SECRET.owner, givenOn: '2026-10-01', method: 'paper', mayShowName: true, mayShowPhotos: true,
  mayShowExactLocation: false, recordedBy: 'x', recordedAt: '2026-10-01T00:00:00Z', ...extra,
});
const batch: BatchItem = { id: SECRET.batchId, name: 'Batch secret', type: 'Fattening', startDate: '2026-06-01', status: 'Active', cowIds: [SECRET.cowId, 'C2'], farmLocation: 'SNR Farm', expectedSellingPrice: SECRET.price, sellingTargetDate: '2026-10-15', notes: 'secret' };
const listing: WebsiteBatchListing = { batchId: SECRET.batchId, published: true, publicBreed: '', publicSex: '', updatedBy: 'x', updatedAt: 'x', photoId: 'p2' };
const news: WebsiteNewsPost = { id: 'n1', titleKm: 'ព័ត៌មាន', titleEn: 'News', bodyKm: 'អត្ថបទ', bodyEn: 'Text', published: true, publishedAt: '2026-10-05T00:00:00Z', createdBy: SECRET.owner, createdAt: 'x', updatedAt: 'x' };

const input = (extra: Partial<SnapshotInput> = {}): SnapshotInput => ({
  farms: [{ id: SECRET.farmId, name: 'SNR Farm' }],
  profiles: [profile()],
  consents: [consent()],
  listings: [listing],
  news: [news, { ...news, id: 'n2', published: false }],
  stock: [cow(SECRET.cowId), cow('C2'), cow('C3', { status: 'Sold' })],
  weights: [{ cowId: SECRET.cowId, currentWeight: SECRET.exactKg, trackingDate: '2026-10-01' }, { cowId: 'C2', currentWeight: 380, trackingDate: '2026-10-01' }] as WeightRecord[],
  batches: [batch],
  feedTransactions: [],
  healthLogs: [],
  saleWindow: 15,
  today: TODAY,
  builtAt: '2026-10-07T03:00:00Z',
  ...extra,
});

describe('public snapshot', () => {
  it('carries only allow-listed fields', () => {
    expect(fieldsOutsideAllowList(buildPublicSnapshot(input()))).toEqual([]);
  });

  it('never contains prices, phones, names, internal ids, notes or exact weights', () => {
    const text = JSON.stringify(buildPublicSnapshot(input()));
    for (const secret of [String(SECRET.price), SECRET.phone, SECRET.owner, SECRET.seller, SECRET.cowId, SECRET.batchId, SECRET.farmId, String(SECRET.exactKg), 'confidential note', 'Batch secret']) {
      expect(text).not.toContain(secret);
    }
  });

  it('shows a published, consented farm with rounded values and a blurred pin', () => {
    const s = buildPublicSnapshot(input());
    expect(s.farms).toHaveLength(1);
    expect(s.farms[0]).toMatchObject({ publicName: 'Green Hill Farm', province: 'Kandal', provinceKm: 'កណ្តាល', lat: 11.5, lng: 105, sizeRange: 'Under 20 head', hasCattleAvailable: true, photoIds: ['p1'] });
    expect(s.cattle).toEqual([{ listingId: farmListingIdOf(SECRET.farmId), farmSlug: s.farms[0].slug, headCount: 'Under 10', weightFrom: 350, weightTo: 400, province: 'Kandal', provinceKm: 'កណ្តាល', availability: 'now' }]);
    expect(s.summary).toMatchObject({ memberFarms: '1', provinces: 1, cattleRaised: '3', feedRecordedTodayPct: 0 });
    expect(s.news.map(n => n.id)).toEqual(['n1']);
  });

  it('leaves out unpublished farms and farms whose consent was withdrawn', () => {
    expect(buildPublicSnapshot(input({ profiles: [profile({ published: false })] })).farms).toEqual([]);
    expect(buildPublicSnapshot(input({ consents: [consent({ withdrawnOn: '2026-10-06' })] })).farms).toEqual([]);
    expect(buildPublicSnapshot(input({ consents: [] })).cattle).toEqual([]);
  });

  it('shows cattle by farm, with no breed, sex, photo or individual animal', () => {
    const entry = buildPublicSnapshot(input()).cattle[0];
    expect(Object.keys(entry).sort()).toEqual(['availability', 'farmSlug', 'headCount', 'listingId', 'province', 'provinceKm', 'weightFrom', 'weightTo']);
    expect(entry.listingId).toBe(farmListingIdOf(SECRET.farmId));
    expect(entry.listingId).not.toContain(SECRET.batchId);
  });

  it('offers a scheduled batch without any office click, and stops when the office hides it', () => {
    expect(buildPublicSnapshot(input({ listings: [] })).cattle).toHaveLength(1);
    expect(buildPublicSnapshot(input({ listings: [{ ...listing, published: false }] })).cattle).toEqual([]);
    expect(buildPublicSnapshot(input({ listings: [{ ...listing, published: false }] })).farms[0].hasCattleAvailable).toBe(false);
  });

  it('shows cattle only for a farm that is on the website with consent', () => {
    expect(buildPublicSnapshot(input({ listings: [], profiles: [profile({ published: false })] })).cattle).toEqual([]);
    expect(buildPublicSnapshot(input({ listings: [], consents: [consent({ withdrawnOn: '2026-10-06' })] })).cattle).toEqual([]);
  });

  it('hides photos when the farmer did not allow them, and skips batches with no selling date soon', () => {
    const s = buildPublicSnapshot(input({ consents: [consent({ mayShowPhotos: false })], batches: [{ ...batch, sellingTargetDate: '2027-06-01' }] }));
    expect(s.farms[0].photoIds).toEqual([]);
    expect(s.cattle).toEqual([]);
    expect(s.farms[0].hasCattleAvailable).toBe(false);
  });
});
