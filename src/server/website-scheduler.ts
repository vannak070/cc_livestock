import { snapshotPublisherService, websiteRequestNotifyService, websiteUpkeepService } from '../services/website';

const PUBLISH_EVERY_MS = 15 * 60 * 1000;
const NOTIFY_EVERY_MS = 2 * 60 * 1000;
const CLEANUP_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_DELAY_MS = 20 * 1000;

/**
 * Keeps the public CamCow website fresh (docs/website/README.md):
 * - rebuilds the public snapshot every 15 minutes (badges, "now"/"soon" and
 *   totals change with time even when nobody edits anything);
 * - every 2 minutes, sends a Telegram message for each new website request
 *   (only where alerts may be sent; see WebsiteRequestNotifyService);
 * - after each publish, tells the group once if publishing has started failing
 *   (and once when it works again);
 * - every 6 hours, deletes website requests older than 24 months.
 * Office changes also publish straight away from the web app.
 */
export function startWebsiteScheduler(): void {
  const publish = async () => {
    try {
      const r = await snapshotPublisherService.publish();
      console.log(`[website] Snapshot published: ${r.farms} farm(s), ${r.cattle} listing(s), ${r.news} post(s).`);
    } catch (err) {
      console.error('[website] Snapshot publish failed:', err instanceof Error ? err.message : err);
    }
    try {
      const alerted = await websiteUpkeepService.alertPublishProblems();
      if (alerted) console.log(`[website] Told the group: publishing ${alerted}.`);
    } catch (err) {
      console.error('[website] Publish alert failed:', err instanceof Error ? err.message : err);
    }
  };
  const cleanUp = async () => {
    try {
      const r = await websiteUpkeepService.deleteOldRequests();
      if (r.applications + r.inquiries > 0) console.log(`[website] Deleted requests older than 24 months: ${r.applications} application(s), ${r.inquiries} inquiry(ies), ${r.photos} photo(s).`);
    } catch (err) {
      console.error('[website] Old request clean-up failed:', err instanceof Error ? err.message : err);
    }
  };
  const notify = async () => {
    try {
      const r = await websiteRequestNotifyService.run();
      if (r.sent > 0) console.log(`[website] Sent ${r.sent} request message(s).`);
    } catch (err) {
      console.error('[website] Request messages failed:', err instanceof Error ? err.message : err);
    }
  };
  setTimeout(() => { void publish(); void notify(); void cleanUp(); }, FIRST_DELAY_MS);
  setInterval(publish, PUBLISH_EVERY_MS);
  setInterval(notify, NOTIFY_EVERY_MS);
  setInterval(cleanUp, CLEANUP_EVERY_MS);
  console.log('[website] Scheduler started: snapshot every 15 minutes, request messages every 2 minutes, old requests cleaned every 6 hours.');
}
