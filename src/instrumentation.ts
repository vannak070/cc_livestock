/**
 * Runs once when the Next.js server starts. The web app runs the daily feed
 * job itself, so feed is estimated for unrecorded days even when the separate
 * API server is not running.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Not while `next build` prerenders pages: only a running server feeds cattle.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { startFeedJob } = await import('./lib/feed-job-scheduler');
  startFeedJob('web app');
}
