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
  ready: false,
  /** e.g. "2025". */
  foundedYear: '',
  /** Street, district, city, as it should be shown. */
  address: 'GIA Tower, 23rd Floor, Sopheakmongkul Street, Diamond Island, Bassac, Chamkarmorn, Phnom Penh',
  /** e.g. "Monday to Saturday, 8:00–17:00". */
  hours: '',
  /** A Google Maps link to the office. */
  mapLink: 'https://www.google.com/maps/search/?api=1&query=GIA+Tower+Diamond+Island+Phnom+Penh',
  team: [] as TeamMember[],
};
