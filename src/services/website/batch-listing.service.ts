import type { Actor } from '../../lib/authz';
import type { WebsiteBatchListing } from '../../lib/types';
import { currentConsent, listingFacts, listingProblem } from '../../lib/website';
import { farmMatcher } from '../../lib/farm-scope';
import { websiteBatchListingRepository, type ListingInput } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';
import { loadWebsiteData } from './website-data';
import { snapshotPublisherService } from './snapshot-publisher.service';

/** Showing a batch as "cattle available" on the website. Super Admin and Admin only. */
export class WebsiteBatchListingService {
  async save(actor: Actor, batchId: string, input: ListingInput, published: boolean): Promise<WebsiteBatchListing> {
    assertWebsiteAdmin(actor);
    if (input.publicBreed.length > 60 || input.publicSex.length > 30) throw new Error('The breed or sex shown is too long.');
    if (input.overrideAvailability && !['now', 'soon'].includes(input.overrideAvailability)) throw new Error('Choose "now" or "soon".');
    if (published) {
      const data = await loadWebsiteData();
      const batch = data.batches.find(b => b.id === batchId);
      if (!batch) throw new Error('That batch no longer exists.');
      const farm = data.farms.find(f => farmMatcher(f.name)(batch.farmLocation));
      const profile = farm && data.profiles.find(p => p.farmId === farm.id);
      const farmPublished = !!(farm && profile?.published && currentConsent(data.consents, farm.id));
      const facts = listingFacts(batch, { publicBreed: input.publicBreed, publicSex: input.publicSex, overrideAvailability: input.overrideAvailability ?? undefined }, data.stock, data.weights, data.today, data.saleWindow);
      const problem = listingProblem(batch, farmPublished, facts.healthyHead);
      if (problem) throw new Error(problem);
    }
    const saved = await websiteBatchListingRepository.save(batchId, input, published, actor.name);
    snapshotPublisherService.publishSoon();
    return saved;
  }
}

export const websiteBatchListingService = new WebsiteBatchListingService();
