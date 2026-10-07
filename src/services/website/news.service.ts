import { randomUUID } from 'crypto';
import type { Actor } from '../../lib/authz';
import type { WebsiteNewsPost } from '../../lib/types';
import { newsProblem, type NewsInput } from '../../lib/website';
import { websiteNewsRepository } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';
import { snapshotPublisherService } from './snapshot-publisher.service';

/** News and training posts. Super Admin and Admin only. */
export class WebsiteNewsService {
  async save(actor: Actor, id: string | null, input: NewsInput): Promise<WebsiteNewsPost> {
    assertWebsiteAdmin(actor);
    const problem = newsProblem(input);
    if (problem) throw new Error(problem);
    const saved = id ? await websiteNewsRepository.update(id, input) : await websiteNewsRepository.create(`NEWS-${randomUUID().slice(0, 8).toUpperCase()}`, input, actor.name);
    if (!saved) throw new Error('That post no longer exists.');
    snapshotPublisherService.publishSoon();
    return saved;
  }

  async setPublished(actor: Actor, id: string, published: boolean): Promise<void> {
    assertWebsiteAdmin(actor);
    if (!(await websiteNewsRepository.find(id))) throw new Error('That post no longer exists.');
    await websiteNewsRepository.setPublished(id, published);
    snapshotPublisherService.publishSoon();
  }

  async delete(actor: Actor, id: string): Promise<void> {
    assertWebsiteAdmin(actor);
    if (!(await websiteNewsRepository.delete(id))) throw new Error('That post no longer exists.');
    snapshotPublisherService.publishSoon();
  }
}

export const websiteNewsService = new WebsiteNewsService();
