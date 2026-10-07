import type { PoolClient } from 'pg';
import type { WebsiteEventKind, WebsiteVisitors } from '../../lib/types';
import { run } from './shared';

const PRESSES: Exclude<WebsiteEventKind, 'view'>[] = ['join', 'call', 'telegram', 'price', 'notify'];
const TZ = 'Asia/Phnom_Penh';

/**
 * Page views and button presses on the public website (table website_events).
 * The website only inserts; the office reads totals here. No cookies,
 * addresses or browser details are stored, so these are views, not people.
 */
export class WebsiteEventRepository {
  async visitors(days: number): Promise<WebsiteVisitors> {
    const since = `at >= NOW() - make_interval(days => $1::int)`;
    const [byDay, pages, presses, devices, refs] = await Promise.all([
      run(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(v.n, 0)::int AS views
           FROM generate_series((NOW() AT TIME ZONE '${TZ}')::date - ($1::int - 1), (NOW() AT TIME ZONE '${TZ}')::date, INTERVAL '1 day') AS d
           LEFT JOIN (SELECT (at AT TIME ZONE '${TZ}')::date AS day, COUNT(*) AS n FROM website_events WHERE kind = 'view' AND ${since} GROUP BY 1) v ON v.day = d::date
          ORDER BY d`,
        [days]
      ),
      run(`SELECT path, COUNT(*)::int AS views FROM website_events WHERE kind = 'view' AND ${since} GROUP BY path ORDER BY views DESC, path LIMIT 10`, [days]),
      run(`SELECT kind, COUNT(*)::int AS n FROM website_events WHERE kind <> 'view' AND ${since} GROUP BY kind`, [days]),
      run(`SELECT device, COUNT(*)::int AS n FROM website_events WHERE kind = 'view' AND ${since} GROUP BY device`, [days]),
      run(`SELECT referrer AS host, COUNT(*)::int AS views FROM website_events WHERE kind = 'view' AND referrer <> '' AND ${since} GROUP BY referrer ORDER BY views DESC LIMIT 8`, [days]),
    ]);
    const count = (rows: { kind?: string; device?: string; n: number }[], key: 'kind' | 'device', value: string) => rows.find(r => r[key] === value)?.n ?? 0;
    const phone = count(devices.rows, 'device', 'phone');
    const views = byDay.rows.reduce((sum, r) => sum + r.views, 0);
    return {
      days,
      views,
      byDay: byDay.rows.map(r => ({ day: r.day, views: r.views })),
      topPages: pages.rows.map(r => ({ path: r.path, views: r.views })),
      presses: Object.fromEntries(PRESSES.map(k => [k, count(presses.rows, 'kind', k)])) as WebsiteVisitors['presses'],
      phoneShare: views > 0 ? Math.round((phone / views) * 100) : null,
      referrers: refs.rows.map(r => ({ host: r.host, views: r.views })),
    };
  }

  /** Deletes visits older than `months`; returns how many went. */
  async deleteOlderThan(months: number, client?: PoolClient): Promise<number> {
    const res = await run('DELETE FROM website_events WHERE at < NOW() - make_interval(months => $1::int)', [months], client);
    return res.rowCount ?? 0;
  }
}

export const websiteEventRepository = new WebsiteEventRepository();
