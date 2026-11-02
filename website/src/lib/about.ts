import { CONTACT, contactMapLink } from './contact';
/**
 * The About us page (/about). Fill in what is empty, then set `ready: true`:
 * the page then shows in the menu, the footer and the sitemap, and the
 * "to fill in" boxes disappear (anything still empty is simply left out).
 * Until then the page can be opened by its address for review, but search
 * engines are asked not to list it.
 */
export interface TeamMember {
  name: string;
  /** e.g. "Founder", "Farm support", "Sales". */
  role: string;
  /** A file in website/public/team/, e.g. "sokha.jpg" (square, at least 400 px). Empty shows initials. */
  photo?: string;
}

export const ABOUT = {
  ready: true,
  /** e.g. "2025". */
  foundedYear: '',
  /** Street, district, city, as it should be shown. */
  address: CONTACT.address.en,
  /** e.g. "Monday to Saturday, 8:00–17:00". */
  hours: '',
  /** A Google Maps link to the office. */
  mapLink: contactMapLink,
  team: [] as TeamMember[],
};

/**
 * The leaders shown with the "Message from our management" on the About page, first one largest. Photos are in
 * website/public/team/ (cut from CamCow's printed stand). Fill in names and titles: until then the message is signed
 * "The management of CAM COW CO., LTD" and the photos show without captions.
 */
/** `photo` is the picture slot (replaceable in the office: Website -> Pictures). */
export const LEADERS: { photo: 'leader-1' | 'leader-2'; name: { en: string; km: string }; title: { en: string; km: string } }[] = [
  { photo: 'leader-1', name: { en: '', km: '' }, title: { en: '', km: '' } },
  { photo: 'leader-2', name: { en: '', km: '' }, title: { en: '', km: '' } },
];

