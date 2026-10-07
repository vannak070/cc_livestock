import type { Actor } from '../../lib/authz';
import type { ApplicationStatus, InquiryStatus, WebsiteApplication, WebsiteInquiry } from '../../lib/types';
import { NOTE_MAX, nextApplicationStatuses, nextInquiryStatuses } from '../../lib/website';
import { settingsRepository } from '../../repositories/settings.repository';
import { websiteRequestRepository } from '../../repositories/website';
import { assertRequestHandler } from './guards';

/** Farm applications and price inquiries from the website. Needs `website_requests`. */
export class WebsiteRequestService {
  async list(actor: Actor): Promise<{ applications: WebsiteApplication[]; inquiries: WebsiteInquiry[] }> {
    assertRequestHandler(actor);
    const [applications, inquiries] = await Promise.all([websiteRequestRepository.findApplications(), websiteRequestRepository.findInquiries()]);
    return { applications, inquiries };
  }

  /** A new status (forward only) and/or notes; an accepted application can be linked to the farm made for it. */
  async updateApplication(actor: Actor, id: string, status: ApplicationStatus, notes: string, farmId?: string): Promise<void> {
    assertRequestHandler(actor);
    const current = await websiteRequestRepository.findApplication(id);
    if (!current) throw new Error('That application no longer exists.');
    if (status !== current.status && !nextApplicationStatuses(current.status).includes(status)) throw new Error('That status change is not allowed.');
    if (notes.length > NOTE_MAX) throw new Error(`Notes can be at most ${NOTE_MAX} characters.`);
    if (farmId) {
      if (status !== 'accepted') throw new Error('Only an accepted application can be linked to a farm.');
      const farms = (await settingsRepository.getSettings()).farms ?? [];
      if (!farms.some(f => f.id === farmId)) throw new Error('That farm does not exist.');
    }
    await websiteRequestRepository.updateApplication(id, status, notes.trim(), actor.name, farmId);
  }

  async updateInquiry(actor: Actor, id: string, status: InquiryStatus, notes: string): Promise<void> {
    assertRequestHandler(actor);
    const current = await websiteRequestRepository.findInquiry(id);
    if (!current) throw new Error('That inquiry no longer exists.');
    if (status !== current.status && !nextInquiryStatuses(current.status).includes(status)) throw new Error('That status change is not allowed.');
    if (notes.length > NOTE_MAX) throw new Error(`Notes can be at most ${NOTE_MAX} characters.`);
    await websiteRequestRepository.updateInquiry(id, status, notes.trim(), actor.name);
  }
}

export const websiteRequestService = new WebsiteRequestService();
