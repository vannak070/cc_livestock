import type { ApplicationStatus, ConsentMethod, InquiryStatus, WebsiteConsent, WebsiteFarmProfile } from '../types';
import { isDay } from '../daily-feed';
import { inCambodia, provinceOf } from './places';

/**
 * Checks for everything the office saves on the Website page. Each returns a
 * plain-English problem, or null when the input is fine. The server runs the
 * same checks the forms show.
 */

export interface ProfileInput {
  publicName: string;
  province: string;
  district: string;
  mapLat?: number | null;
  mapLng?: number | null;
  storyKm: string;
  storyEn: string;
  memberSince?: number | null;
  photoIds: string[];
}

export const MAX_PROFILE_PHOTOS = 6;
export const MAX_STORY = 600;

export function profileProblem(input: ProfileInput, thisYear: number): string | null {
  const name = input.publicName.trim();
  if (name.length < 3 || name.length > 60) return 'The public name must be 3 to 60 characters.';
  if (!provinceOf(input.province)) return 'Choose the province.';
  if (!input.district.trim()) return 'Write the district.';
  if (input.district.trim().length > 60) return 'The district name is too long.';
  const hasLat = input.mapLat !== undefined && input.mapLat !== null;
  const hasLng = input.mapLng !== undefined && input.mapLng !== null;
  if (hasLat !== hasLng) return 'Give both map numbers (latitude and longitude), or neither.';
  if (hasLat && hasLng && !inCambodia(input.mapLat!, input.mapLng!)) return 'The map pin must be inside Cambodia.';
  if (input.storyKm.length > MAX_STORY || input.storyEn.length > MAX_STORY) return `The story can be at most ${MAX_STORY} characters.`;
  if (input.memberSince !== undefined && input.memberSince !== null && (!Number.isInteger(input.memberSince) || input.memberSince < 2000 || input.memberSince > thisYear)) {
    return 'Member since must be a year between 2000 and this year.';
  }
  if (input.photoIds.length > MAX_PROFILE_PHOTOS) return `Up to ${MAX_PROFILE_PHOTOS} photos.`;
  return null;
}

export interface ConsentInput {
  givenByName: string;
  givenOn: string;
  method: ConsentMethod;
  mayShowName: boolean;
  mayShowPhotos: boolean;
  mayShowExactLocation: boolean;
}

export const CONSENT_METHODS: readonly ConsentMethod[] = ['paper', 'web_form', 'other'];

export function consentProblem(input: ConsentInput, today: string): string | null {
  if (input.givenByName.trim().length < 2) return 'Write the name of the person who agreed.';
  if (!isDay(input.givenOn)) return 'Choose the date they agreed.';
  if (input.givenOn > today) return 'The date cannot be in the future.';
  if (!CONSENT_METHODS.includes(input.method)) return 'Choose how they agreed.';
  if (!input.mayShowName) return 'The farm cannot be shown without permission to show its name.';
  return null;
}

/** The consent in force for a farm: the newest one not withdrawn. */
export function currentConsent(consents: WebsiteConsent[], farmId: string): WebsiteConsent | null {
  return consents
    .filter(c => c.farmId === farmId && !c.withdrawnOn)
    .sort((a, b) => b.givenOn.localeCompare(a.givenOn) || b.recordedAt.localeCompare(a.recordedAt))[0] ?? null;
}

/** Why a farm's profile cannot be published yet, or null. */
export function publishProblem(profile: Pick<WebsiteFarmProfile, 'publicName' | 'province' | 'district'> | null, consent: WebsiteConsent | null): string | null {
  if (!consent) return "Record the farmer's consent before publishing.";
  if (!profile || profile.publicName.trim().length < 3) return 'Give the farm a public name first.';
  if (!provinceOf(profile.province) || !profile.district.trim()) return 'Set the province and district first.';
  return null;
}

export interface NewsInput {
  titleKm: string;
  titleEn: string;
  bodyKm: string;
  bodyEn: string;
  photoId?: string | null;
}

export function newsProblem(input: NewsInput): string | null {
  if (!input.titleKm.trim()) return 'Write the title in Khmer.';
  if (!input.bodyKm.trim()) return 'Write the text in Khmer.';
  if (input.titleKm.length > 120 || input.titleEn.length > 120) return 'The title can be at most 120 characters.';
  if (input.bodyKm.length > 5000 || input.bodyEn.length > 5000) return 'The text can be at most 5,000 characters.';
  return null;
}

/** Requests only move forward: New -> Contacted -> Accepted or Declined (applications), Closed (inquiries). */
const APPLICATION_NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ['contacted', 'declined'],
  contacted: ['accepted', 'declined'],
  accepted: [],
  declined: [],
};
const INQUIRY_NEXT: Record<InquiryStatus, InquiryStatus[]> = {
  new: ['contacted', 'closed'],
  contacted: ['closed'],
  closed: [],
};

export const nextApplicationStatuses = (s: ApplicationStatus): ApplicationStatus[] => APPLICATION_NEXT[s] ?? [];
export const nextInquiryStatuses = (s: InquiryStatus): InquiryStatus[] => INQUIRY_NEXT[s] ?? [];

export const NOTE_MAX = 1000;

/** Photos are re-encoded in the browser (which drops GPS data) before upload: WebP, or JPEG where the browser cannot make WebP (Safari). */
export const PHOTO_MIMES: readonly string[] = ['image/webp', 'image/jpeg'];
export const PHOTO_LARGE_PX = 1600;
export const PHOTO_SMALL_PX = 600;
export const PHOTO_MAX_BYTES = 1_500_000;

export function photoProblem(mime: string, largeBytes: number, smallBytes: number, width: number, height: number): string | null {
  if (!PHOTO_MIMES.includes(mime)) return 'The photo must be prepared by the app (WebP or JPEG).';
  if (largeBytes <= 0 || smallBytes <= 0) return 'The photo is empty.';
  if (largeBytes > PHOTO_MAX_BYTES || smallBytes > PHOTO_MAX_BYTES) return 'The photo is too large.';
  if (width < 200 || height < 200 || width > PHOTO_LARGE_PX || height > PHOTO_LARGE_PX) return 'The photo size is not right. Choose another photo.';
  return null;
}
