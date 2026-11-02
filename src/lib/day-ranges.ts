/**
 * Groups YYYY-MM-DD days into runs of consecutive days, so a list of seven missed days
 * can read "Oct 7 – Oct 13" instead of seven comma-separated dates. Order is kept; an
 * unsorted or repeated list is sorted and de-duplicated first.
 */
export function groupConsecutiveDays(days: string[]): string[][] {
  const sorted = [...new Set(days)].sort();
  const runs: string[][] = [];
  for (const day of sorted) {
    const last = runs[runs.length - 1];
    if (last && nextDay(last[last.length - 1]) === day) last.push(day);
    else runs.push([day]);
  }
  return runs;
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * "Wed 7 Oct – Tue 13 Oct, Fri 16 Oct": each run of two or more days becomes "first – last"
 * (an en dash), a lone day stays as it is. `label` formats one day.
 */
export function dayRangesLabel(days: string[], label: (day: string) => string): string {
  return groupConsecutiveDays(days)
    .map(run => (run.length === 1 ? label(run[0]) : `${label(run[0])} – ${label(run[run.length - 1])}`))
    .join(', ');
}
