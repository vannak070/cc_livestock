import type { Actor } from '../../lib/authz';
import type { BatchItem, WebsiteBatchListing, WebsiteConsent, WebsiteFarmProfile, WebsiteNewsPost } from '../../lib/types';
import {
  buildPublicSnapshot, canHandleWebsiteRequests, canPublishWebsite, currentConsent, listingFacts, listingIdOf, listingProblem,
  publishProblem, type ListingFacts, type PublicSnapshot,
} from '../../lib/website';
import { farmMatcher } from '../../lib/farm-scope';
import { websiteRequestRepository } from '../../repositories/website';
import { assertRequestHandler, assertWebsiteAdmin } from './guards';
import { loadWebsiteData } from './website-data';
import { snapshotPublisherService } from './snapshot-publisher.service';

export interface FarmRow {
  farmId: string;
  farmName: string;
  profile: WebsiteFarmProfile | null;
  consent: WebsiteConsent | null;
  consents: WebsiteConsent[];
  /** Why it cannot be published yet; null when it can. */
  publishBlock: string | null;
}

export interface BatchRow {
  batch: Pick<BatchItem, 'id' | 'name' | 'farmLocation' | 'status' | 'sellingTargetDate'>;
  listing: WebsiteBatchListing | null;
  listingId: string;
  facts: ListingFacts;
  farmPublished: boolean;
  /** Why it cannot be shown; null when it can. */
  listBlock: string | null;
}

/** Everything the Website page shows. Admins get all of it; request handlers only the counts. */
export interface WebsiteOverview {
  canPublish: boolean;
  canHandleRequests: boolean;
  farms: FarmRow[];
  batches: BatchRow[];
  news: WebsiteNewsPost[];
  newRequests: { applications: number; inquiries: number };
  /** When the live public snapshot was built; null before the first publish. */
  lastPublishedAt: string | null;
}

export class WebsiteOverviewService {
  async overview(actor: Actor): Promise<WebsiteOverview> {
    const canPublish = canPublishWebsite(actor);
    const canHandleRequests = canHandleWebsiteRequests(actor);
    if (!canPublish) assertRequestHandler(actor);
    const newRequests = canHandleRequests ? await websiteRequestRepository.countNew() : { applications: 0, inquiries: 0 };
    if (!canPublish) return { canPublish, canHandleRequests, farms: [], batches: [], news: [], newRequests, lastPublishedAt: null };

    const data = await loadWebsiteData();
    const farms: FarmRow[] = data.farms.map(f => {
      const profile = data.profiles.find(p => p.farmId === f.id) ?? null;
      const consent = currentConsent(data.consents, f.id);
      return { farmId: f.id, farmName: f.name, profile, consent, consents: data.consents.filter(c => c.farmId === f.id), publishBlock: publishProblem(profile, consent) };
    });
    const publishedFarms = farms.filter(f => f.profile?.published && f.consent).map(f => farmMatcher(f.farmName));

    const batches: BatchRow[] = data.batches
      .filter(b => b.status === 'Active')
      .map(b => {
        const listing = data.listings.find(l => l.batchId === b.id) ?? null;
        const facts = listingFacts(b, listing ?? undefined, data.stock, data.weights, data.today, data.saleWindow);
        const farmPublished = publishedFarms.some(m => m(b.farmLocation));
        return {
          batch: { id: b.id, name: b.name, farmLocation: b.farmLocation, status: b.status, sellingTargetDate: b.sellingTargetDate },
          listing, listingId: listingIdOf(b.id), facts, farmPublished,
          listBlock: listingProblem(b, farmPublished, facts.healthyHead),
        };
      })
      .sort((a, b) => (a.batch.farmLocation ?? '').localeCompare(b.batch.farmLocation ?? '') || a.batch.name.localeCompare(b.batch.name));

    return { canPublish, canHandleRequests, farms, batches, news: data.news, newRequests, lastPublishedAt: await snapshotPublisherService.lastBuiltAt() };
  }

  /** Exactly what the public website would show right now. */
  async preview(actor: Actor): Promise<PublicSnapshot> {
    assertWebsiteAdmin(actor);
    return buildPublicSnapshot(await loadWebsiteData());
  }
}

export const websiteOverviewService = new WebsiteOverviewService();
