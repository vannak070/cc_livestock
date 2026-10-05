/**
 * A calendar day (YYYY-MM-DD) from what the database driver hands back for a
 * DATE column: a JavaScript Date at local midnight. Going through
 * toISOString() would read it in UTC and, on a server east of UTC such as
 * Cambodia (UTC+7), return the day before.
 */
export function localDay(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
  if (Number.isNaN(value.getTime())) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
}
