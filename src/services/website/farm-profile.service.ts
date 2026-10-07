import { randomUUID } from 'crypto';
import type { Actor } from '../../lib/authz';
import type { WebsiteConsent, WebsiteFarmProfile } from '../../lib/types';
import { farmToday } from '../../lib/daily-feed';
import { consentProblem, currentConsent, profileProblem, publishProblem, type ConsentInput, type ProfileInput } from '../../lib/website';
import { withTransaction } from '../../config/database';
import { settingsRepository } from '../../repositories/settings.repository';
import { websiteConsentRepository, websiteFarmProfileRepository } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';
import { snapshotPublisherService } from './snapshot-publisher.service';

/** A member farm's public profile and the farmer's consent. Super Admin and Admin only. */
export class WebsiteFarmProfileService {
  private async assertFarm(farmId: string): Promise<void> {
    const farms = (await settingsRepository.getSettings()).farms ?? [];
    if (!farms.some(f => f.id === farmId)) throw new Error('That farm no longer exists.');
  }

  async save(actor: Actor, farmId: string, input: ProfileInput): Promise<WebsiteFarmProfile> {
    assertWebsiteAdmin(actor);
    await this.assertFarm(farmId);
    const problem = profileProblem(input, Number(farmToday().slice(0, 4)));
    if (problem) throw new Error(problem);
    const saved = await websiteFarmProfileRepository.save(farmId, input, actor.name);
    snapshotPublisherService.publishSoon();
    return saved;
  }

  async recordConsent(actor: Actor, farmId: string, input: ConsentInput): Promise<WebsiteConsent> {
    assertWebsiteAdmin(actor);
    await this.assertFarm(farmId);
    const problem = consentProblem(input, farmToday());
    if (problem) throw new Error(problem);
    return websiteConsentRepository.create(`CONSENT-${randomUUID().slice(0, 8).toUpperCase()}`, farmId, input, actor.name);
  }

  /** The farmer asked to be removed: consent withdrawn and the profile taken off the website at once. */
  async withdrawConsent(actor: Actor, farmId: string): Promise<void> {
    assertWebsiteAdmin(actor);
    await withTransaction(async client => {
      await websiteConsentRepository.withdrawAll(farmId, farmToday(), actor.name, client);
      await websiteFarmProfileRepository.setPublished(farmId, false, actor.name, client);
    });
    snapshotPublisherService.publishSoon();
  }

  async setPublished(actor: Actor, farmId: string, published: boolean): Promise<void> {
    assertWebsiteAdmin(actor);
    if (published) {
      const [profile, consents] = await Promise.all([websiteFarmProfileRepository.find(farmId), websiteConsentRepository.findByFarm(farmId)]);
      const problem = publishProblem(profile, currentConsent(consents, farmId));
      if (problem) throw new Error(problem);
    }
    await websiteFarmProfileRepository.setPublished(farmId, published, actor.name);
    snapshotPublisherService.publishSoon();
  }
}

export const websiteFarmProfileService = new WebsiteFarmProfileService();
