/**
 * Khmer day and month names, so Khmer dates do not depend on the phone's
 * browser having Khmer date data (some do not and fall back to English).
 * Drafted by Claude; the weekday names are the standard ones.
 */
export const KM_WEEKDAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
export const KM_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

/** A YYYY-MM-DD day as "សុក្រ 2 តុលា". */
export function khmerShortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${KM_WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${KM_MONTHS[d.getUTCMonth()]}`;
}

/** A date as "ថ្ងៃសុក្រ 2 តុលា 2026" (in the device's local time). */
export function khmerLongDate(date: Date): string {
  return `ថ្ងៃ${KM_WEEKDAYS[date.getDay()]} ${date.getDate()} ${KM_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A YYYY-MM month as "Oct 2026", or "តុលា 2026" in Khmer. */
export function monthLabel(ym: string, language?: string): string {
  const m = Number(ym.slice(5, 7)) - 1;
  if (!(m >= 0 && m < 12)) return ym;
  return `${(language === 'km' ? KM_MONTHS : EN_MONTHS)[m]} ${ym.slice(0, 4)}`;
}

/** A stored date as the app shows it: "2026-10-02" in English (as before), "2 តុលា 2026" in Khmer. */
export function shownDay(day: string | null | undefined, language?: string): string {
  if (!day) return '—';
  const d = day.slice(0, 10);
  if (language !== 'km') return d;
  const m = Number(d.slice(5, 7)) - 1;
  if (!(m >= 0 && m < 12) || d.length < 10) return d;
  return `${Number(d.slice(8, 10))} ${KM_MONTHS[m]} ${d.slice(0, 4)}`;
}
