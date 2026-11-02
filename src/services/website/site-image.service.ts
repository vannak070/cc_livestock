import type { Actor } from '../../lib/authz';
import { isSiteImageSlot } from '../../lib/website';
import { websitePhotoRepository, websiteSiteImageRepository } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';
import { snapshotPublisherService } from './snapshot-publisher.service';

/** The built-in website pictures (Website -> Pictures). Super Admin and Admin only. */
export class WebsiteSiteImageService {
  /** Shows `photoId` (uploaded with the website photo upload) in `slot`; null goes back to the original picture. */
  async set(actor: Actor, slot: string, photoId: string | null): Promise<void> {
    assertWebsiteAdmin(actor);
    if (!isSiteImageSlot(slot)) throw new Error('That picture is not one the website has.');
    if (photoId === null) {
      await websiteSiteImageRepository.clear(slot);
    } else {
      if (!(await websitePhotoRepository.bytes(photoId, 'small'))) throw new Error('That photo is no longer there. Please choose it again.');
      await websiteSiteImageRepository.set(slot, photoId, actor.name);
    }
    snapshotPublisherService.publishSoon();
  }
}

export const websiteSiteImageService = new WebsiteSiteImageService();
