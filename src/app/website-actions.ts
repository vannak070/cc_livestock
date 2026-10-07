'use server';

/**
 * Server actions for the Website page (the public CamCow website's office
 * side, docs/website/README.md). Kept apart from actions.ts so the whole
 * website feature is easy to find. Like every action, each one goes through
 * runAction (session check); the services then check the website roles:
 * publishing = Super Admin and Admin, requests = `website_requests`.
 */

import { runAction } from '@/lib/run-action';
import type { ApplicationStatus, InquiryStatus } from '@/lib/types';
import type { ConsentInput, NewsInput, ProfileInput } from '@/lib/website';
import type { ListingInput } from '@/repositories/website';
import {
  websiteBatchListingService, websiteFarmProfileService, websiteNewsService, websiteOverviewService, websitePhotoService,
  websiteRequestService, snapshotPublisherService, type PhotoUpload,
} from '@/services/website';

// Reads (no page refresh needed).
export async function getWebsiteOverviewAction() {
  return runAction('Failed to load the website settings', [], actor => websiteOverviewService.overview(actor), { revalidate: false });
}

export async function getWebsitePreviewAction() {
  return runAction('Failed to build the preview', [], actor => websiteOverviewService.preview(actor), { revalidate: false });
}

export async function getWebsiteRequestsAction() {
  return runAction('Failed to load the requests', [], actor => websiteRequestService.list(actor), { revalidate: false });
}

// Member farms.
export async function saveWebsiteProfileAction(farmId: string, input: ProfileInput) {
  return runAction('Failed to save the profile', [], actor => websiteFarmProfileService.save(actor, farmId, input), { revalidate: false });
}

export async function recordWebsiteConsentAction(farmId: string, input: ConsentInput) {
  return runAction('Failed to record the consent', [], actor => websiteFarmProfileService.recordConsent(actor, farmId, input), { revalidate: false });
}

export async function withdrawWebsiteConsentAction(farmId: string) {
  return runAction('Failed to withdraw the consent', [], actor => websiteFarmProfileService.withdrawConsent(actor, farmId), { revalidate: false });
}

export async function setWebsiteProfilePublishedAction(farmId: string, published: boolean) {
  return runAction('Failed to change the website', [], actor => websiteFarmProfileService.setPublished(actor, farmId, published), { revalidate: false });
}

// Cattle available.
export async function saveWebsiteListingAction(batchId: string, input: ListingInput, published: boolean) {
  return runAction('Failed to save the listing', [], actor => websiteBatchListingService.save(actor, batchId, input, published), { revalidate: false });
}

// Applications and inquiries.
export async function updateWebsiteApplicationAction(id: string, status: ApplicationStatus, notes: string, farmId?: string) {
  return runAction('Failed to update the application', [], actor => websiteRequestService.updateApplication(actor, id, status, notes, farmId), { revalidate: false });
}

export async function createFarmFromApplicationAction(id: string, farmName: string) {
  return runAction('Failed to create the farm', [], actor => websiteRequestService.createFarmFromApplication(actor, id, farmName));
}

export async function updateWebsiteInquiryAction(id: string, status: InquiryStatus, notes: string) {
  return runAction('Failed to update the inquiry', [], actor => websiteRequestService.updateInquiry(actor, id, status, notes), { revalidate: false });
}

// News.
export async function saveWebsiteNewsAction(id: string | null, input: NewsInput) {
  return runAction('Failed to save the post', [], actor => websiteNewsService.save(actor, id, input), { revalidate: false });
}

export async function setWebsiteNewsPublishedAction(id: string, published: boolean) {
  return runAction('Failed to change the post', [], actor => websiteNewsService.setPublished(actor, id, published), { revalidate: false });
}

export async function deleteWebsiteNewsAction(id: string) {
  return runAction('Failed to delete the post', [], actor => websiteNewsService.delete(actor, id), { revalidate: false });
}

// Photos.
export async function uploadWebsitePhotoAction(input: PhotoUpload) {
  return runAction('Failed to upload the photo', [], actor => websitePhotoService.upload(actor, input), { revalidate: false });
}

// Publishing the public snapshot now (it also happens after every change above, and every 15 minutes).
export async function publishWebsiteNowAction() {
  return runAction('Failed to publish the website', [], actor => snapshotPublisherService.publishAs(actor), { revalidate: false });
}
