/**
 * Watches the public website from outside its own server and the office API: reads the website's health check
 * (`/public/v1/health`) and sends ONE Telegram message when it goes wrong (old data, CC Livestock unreachable, form
 * entries waiting) and one when it is fine again. Run it every 10 minutes from cron or launchd on a machine that
 * stays on; an outside uptime monitor watching the same address is even better (it also notices this machine
 * being off).
 *
 *   npx tsx scripts/website-watch.ts            (or: npm run website:watch)
 *   npx tsx scripts/website-watch.ts --dry-run  (prints what it would send, sends nothing)
 *
 * Settings (env): WEBSITE_HEALTH_URL (default http://localhost:3200/public/v1/health), TELEGRAM_BOT_TOKEN (the
 * office bot), WEBSITE_WATCH_CHAT_ID (who gets the message). State is kept in .website-watch.json so a problem is
 * reported once, not every run.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const DRY = process.argv.includes('--dry-run');
const URL_ = process.env.WEBSITE_HEALTH_URL?.trim() || 'http://localhost:3200/public/v1/health';
const STATE = path.join(process.cwd(), '.website-watch.json');

async function check(): Promise<string | null> {
  try {
    const res = await fetch(URL_, { signal: AbortSignal.timeout(20_000), headers: { 'cache-control': 'no-store' } });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { problems?: string[] } | null;
    return body?.problems?.length ? body.problems.join('; ') : `the website answered ${res.status}`;
  } catch (err) {
    return `the website cannot be reached (${err instanceof Error ? err.message : String(err)})`;
  }
}

async function send(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = process.env.WEBSITE_WATCH_CHAT_ID?.trim();
  if (DRY || !token || !chat) {
    console.log(`[website-watch] ${DRY ? 'Would send' : 'Not sent (TELEGRAM_BOT_TOKEN or WEBSITE_WATCH_CHAT_ID missing)'}: ${text}`);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Telegram answered ${res.status}`);
}

async function main() {
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')) as { problem?: string; since?: string }; } catch { return {}; } })();
  const problem = await check();
  const now = new Date().toISOString();
  if (problem && !state.problem) {
    await send(`⚠️ CamCow website: ${problem}. Visitors may see old cattle or their forms wait. Check that Docker and the CC Livestock API are running.`);
    if (!DRY) fs.writeFileSync(STATE, JSON.stringify({ problem, since: now }));
  } else if (!problem && state.problem) {
    await send(`✅ CamCow website is fine again (problem since ${state.since}: ${state.problem}).`);
    if (!DRY) fs.writeFileSync(STATE, JSON.stringify({}));
  }
  console.log(`[website-watch] ${problem ? `Problem: ${problem}` : 'OK'}`);
}

main().catch(err => { console.error('[website-watch]', err instanceof Error ? err.message : err); process.exitCode = 1; });
