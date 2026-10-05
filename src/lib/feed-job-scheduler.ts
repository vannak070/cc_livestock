import { runDailyFeedStockOuts } from './daily-feed-cron';

const HOUR_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30 * 1000;

/**
 * Runs the daily feed job a little after start-up and then every hour, in
 * whichever server process calls it: the web app (src/instrumentation.ts) and
 * the API server (src/server/index.ts). Running it in both is safe: a unique
 * reference per batch, day and feed means a day is only ever written once.
 * Started once per process; FEED_JOB=off turns it off (for example on a
 * second web instance).
 */
export function startFeedJob(where: string): void {
  const g = globalThis as typeof globalThis & { __ccFeedJobStarted?: boolean };
  if (g.__ccFeedJobStarted || process.env.FEED_JOB === 'off') return;
  g.__ccFeedJobStarted = true;

  const run = () =>
    runDailyFeedStockOuts().catch(e => console.warn(`[Daily Feed Cron] Run failed (${where}):`, e instanceof Error ? e.message : e));
  setTimeout(run, FIRST_RUN_DELAY_MS).unref();
  setInterval(run, HOUR_MS).unref();
  console.log(`[Daily Feed Cron] Scheduled hourly in the ${where}.`);
}
