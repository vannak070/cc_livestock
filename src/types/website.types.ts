/**
 * The public CamCow website, office side (docs/website/README.md).
 * These records live in CC Livestock and are managed on the Website page;
 * the public site only ever sees the rounded snapshot built from them
 * (see PublicSnapshot in src/lib/website/snapshot.ts).
 */

/** A member farm's public profile (table website_farm_profiles). */
export interface WebsiteFarmProfile {
  farmId: string;
  publicName: string;
  province: string;
  district: string;
  /** Map pin. Shown exactly only when the consent allows it; otherwise the district's centre is used. */
  mapLat?: number;
  mapLng?: number;
  storyKm: string;
  storyEn: string;
  memberSince?: number;
  photoIds: string[];
  published: boolean;
  publishedBy?: string;
  publishedAt?: string;
  updatedBy: string;
  updatedAt: string;
}

export type ConsentMethod = 'paper' | 'web_form' | 'other';

/** A farmer's agreement to be shown on the website (table website_consents). */
export interface WebsiteConsent {
  id: string;
  farmId: string;
  givenByName: string;
  /** YYYY-MM-DD */
  givenOn: string;
  method: ConsentMethod;
  mayShowName: boolean;
  mayShowPhotos: boolean;
  mayShowExactLocation: boolean;
  recordedBy: string;
  recordedAt: string;
  withdrawnOn?: string;
  withdrawnBy?: string;
}

export type Availability = 'now' | 'soon';

/** A batch offered on the website (table website_batch_listings). */
export interface WebsiteBatchListing {
  batchId: string;
  published: boolean;
  /** Empty = worked out from the batch's cattle. */
  publicBreed: string;
  publicSex: string;
  /** Empty = worked out from the selling date. */
  overrideAvailability?: Availability;
  photoId?: string;
  publishedBy?: string;
  publishedAt?: string;
  updatedBy: string;
  updatedAt: string;
}

export type ApplicationStatus = 'new' | 'contacted' | 'accepted' | 'declined';
export type InquiryStatus = 'new' | 'contacted' | 'closed';

/** A "Join as a member" form (table website_applications). */
export interface WebsiteApplication {
  id: string;
  name: string;
  phone: string;
  province: string;
  district: string;
  landM2?: number;
  cattleNow?: number;
  hasPens?: boolean;
  photoIds: string[];
  consentChecked: boolean;
  language: 'km' | 'en';
  status: ApplicationStatus;
  handledBy?: string;
  notes: string;
  /** The farm made from this application, once accepted. */
  farmId?: string;
  createdAt: string;
  updatedAt: string;
}

export type InquiryKind = 'price' | 'notify';

/** An "Ask for a price" form, or a buyer's "tell me when cattle are available" (kind notify) (table website_inquiries). */
export interface WebsiteInquiry {
  id: string;
  kind: InquiryKind;
  name: string;
  phone: string;
  buyerType: string;
  quantity?: number;
  weightClass: string;
  listingRef?: string;
  message: string;
  language: 'km' | 'en';
  status: InquiryStatus;
  handledBy?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** A news or training post (table website_news). */
export interface WebsiteNewsPost {
  id: string;
  titleKm: string;
  titleEn: string;
  bodyKm: string;
  bodyEn: string;
  photoId?: string;
  published: boolean;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A stored photo's details (the image bytes are fetched separately). */
export interface WebsitePhotoInfo {
  id: string;
  mime: string;
  width: number;
  height: number;
  uploadedBy: string;
  createdAt: string;
}

/** Whether the public snapshot is being published (rules in src/lib/website/health.ts). Stored in MasterSetup.websiteStatus. */
export interface WebsitePublishStatus {
  /** The last snapshot that was written. */
  lastOkAt?: string;
  /** The last try that failed, and why (server wording, for admins only). */
  lastFailedAt?: string;
  lastError?: string | null;
  /** When the current run of failures began; null once a publish works again. */
  failingSince?: string | null;
  /** When the Telegram message about the current failures was sent. */
  failureAlertedAt?: string | null;
}

export type WebsiteEventKind = 'view' | 'join' | 'call' | 'telegram' | 'price' | 'notify';

/** Visitor numbers for the Website page (from website_events; no cookies or addresses are stored). */
export interface WebsiteVisitors {
  days: number;
  views: number;
  /** One entry per day, oldest first, YYYY-MM-DD (Cambodia time). */
  byDay: { day: string; views: number }[];
  topPages: { path: string; views: number }[];
  presses: Record<Exclude<WebsiteEventKind, 'view'>, number>;
  phoneShare: number | null;
  referrers: { host: string; views: number }[];
}
