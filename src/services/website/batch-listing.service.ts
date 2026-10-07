import type { Actor } from '../../lib/authz';
import type { WebsiteBatchListing } from '../../lib/types';
import { websiteBatchListingRepository, type ListingInput } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';
import { loadWebsiteData } from './website-data';
import { snapshotPublisherService } from './snapshot-publisher.service';

/** Switching a batch off the website, or putting it back, and the schedule override. Super Admin and Admin only. */
export class WebsiteBatchListingService {
  async save(actor: Actor, batchId: string, input: ListingInput, published: boolean): Promise<WebsiteBatchListing> {
    assertWebsiteAdmin(actor);
    if (input.publicBreed.length > 60 || input.publicSex.length > 30) throw new Error('The breed or sex shown is too long.');
    if (input.overrideAvailability && !['now', 'soon'].includes(input.overrideAvailability)) throw new Error('Choose "now" or "soon".');
    // A batch is offered on the website by default (the sell schedule decides when), so saving only needs the batch to exist.
    // Whether it actually shows still depends on its farm being published, its schedule and healthy animals (see the Cattle tab).
    const data = await loadWebsiteData();
    if (!data.batches.some(b => b.id === batchId)) throw new Error('That batch no longer exists.');
    const saved = await websiteBatchListingRepository.save(batchId, input, published, actor.name);
    snapshotPublisherService.publishSoon();
    return saved;
  }
}

export const websiteBatchListingService = new WebsiteBatchListingService();
