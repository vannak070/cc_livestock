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
