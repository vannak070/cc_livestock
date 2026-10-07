import type { Actor } from '../../lib/authz';
import type { ApplicationStatus, InquiryStatus, WebsiteApplication, WebsiteInquiry } from '../../lib/types';
import { NOTE_MAX, nextApplicationStatuses, nextInquiryStatuses, provinceOf } from '../../lib/website';
import { withTransaction } from '../../config/database';
import { settingsRepository } from '../../repositories/settings.repository';
import { websiteFarmProfileRepository, websiteRequestRepository } from '../../repositories/website';
import { farmService } from '../farm.service';
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

  /**
   * Makes a new farm in CC Livestock from an application the office has called
   * (Contacted or Accepted), accepts the application and links it to the farm,
   * and starts an unpublished website profile with the place the farmer gave.
   * Needs `website_requests` plus the right to manage farms. The farm gets no
   * cattle limit: a Super Admin or Admin sets that (src/lib/farm-limit.ts).
   */
  async createFarmFromApplication(actor: Actor, id: string, farmName: string): Promise<{ farmId: string; farmName: string }> {
    assertRequestHandler(actor);
    const app = await websiteRequestRepository.findApplication(id);
    if (!app) throw new Error('That application no longer exists.');
    if (app.farmId) throw new Error('This application is already linked to a farm.');
    if (app.status !== 'contacted' && app.status !== 'accepted') throw new Error('Call the farmer first: mark the application Contacted, then create the farm.');
    const province = provinceOf(app.province);
    const farm = await farmService.saveFarm(actor, {
      name: farmName,
      address: [app.district.trim(), province?.key ?? app.province].filter(Boolean).join(', '),
      capacity: 0,
      notes: `From a website application by ${app.name} (sent ${app.createdAt.slice(0, 10)}).`,
      companyRun: false,
    }, null);
    await withTransaction(async client => {
      await websiteRequestRepository.updateApplication(id, 'accepted', app.notes, actor.name, farm.id, client);
      if (province && !(await websiteFarmProfileRepository.find(farm.id, client))) {
        await websiteFarmProfileRepository.save(farm.id, {
          publicName: farm.name, province: province.key, district: app.district.trim().slice(0, 60), storyKm: '', storyEn: '', photoIds: [],
        }, actor.name, client);
      }
    });
    return { farmId: farm.id, farmName: farm.name };
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
