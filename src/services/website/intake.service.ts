import { checkApplicationIn, checkEventIn, checkInquiryIn, deviceOf } from '../../lib/website/intake';
import { websiteIntakeRepository } from '../../repositories/website/intake.repository';
import { checkPhotosIn } from './intake-photos';

export type IntakeResult = { ok: true } | { ok: false; field: string };

/**
 * Entries from the public website. Everything is checked again here: the
 * website is on the open internet, so its checks are for the visitor's
 * convenience, not for CC Livestock's safety.
 */
export class WebsiteIntakeService {
  async application(raw: Record<string, unknown>): Promise<IntakeResult> {
    const checked = checkApplicationIn(raw);
    if (!checked.ok) return { ok: false, field: checked.field };
    const photos = checkPhotosIn(raw.photos);
    if (!photos) return { ok: false, field: 'photos' };
    await websiteIntakeRepository.insertApplication(checked.value, photos);
    return { ok: true };
  }

  async inquiry(raw: Record<string, unknown>): Promise<IntakeResult> {
    const checked = checkInquiryIn(raw);
    if (!checked.ok) return { ok: false, field: checked.field };
    await websiteIntakeRepository.insertInquiry(checked.value);
    return { ok: true };
  }

  /** A visit count; anything odd is quietly ignored. */
  async event(raw: Record<string, unknown>): Promise<boolean> {
    const event = checkEventIn(raw);
    if (!event) return false;
    await websiteIntakeRepository.insertEvent(event, deviceOf(raw.device));
    return true;
  }
}

export const websiteIntakeService = new WebsiteIntakeService();
