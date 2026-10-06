import { capacityAlertService } from '../services/capacity-alert.service';
import { lowFeedAlertService } from '../services/low-feed-alert.service';
import { settingsRepository } from '../repositories/settings.repository';
import { dailyAlertService } from '../services/daily-alert.service';
import { telegramService } from '../services/telegram.service';

const EVERY_MS = 10 * 60 * 1000;
const FIRST_DELAY_MS = 30 * 1000;

/** Leaves a timestamp in the settings so the Alerts panel can show that the scheduler is alive. */
async function heartbeat(): Promise<void> {
  try {
    const current = (await settingsRepository.getSettings()).alertStatus ?? {};
    await settingsRepository.patchBlob({ alertStatus: { ...current, schedulerSeenAt: new Date().toISOString() } });
  } catch (err) {
    console.error('[alerts] Could not record the scheduler heartbeat:', err instanceof Error ? err.message : err);
  }
}

/**
 * Checks for sale alerts to send every few minutes. Runs in production, or in
 * development only when ALERTS_SCHEDULER=on, so working on the app never sends
 * real Telegram messages by accident.
 */
export function startAlertScheduler(): void {
  if (!telegramService.sendingAllowedHere()) {
    console.log('[alerts] Scheduler is off outside production (set ALERTS_SCHEDULER=on to run it).');
    return;
  }
  if (!telegramService.isConfigured()) {
    console.log('[alerts] TELEGRAM_BOT_TOKEN is not set: Telegram alerts are off.');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    await heartbeat();
    // The per-farm messages: selling reminder, long stay, 5 pm feed reminder.
    try {
      const daily = await dailyAlertService.run();
      if (daily.sent > 0) console.log(`[alerts] Sent ${daily.sent} farm message(s).`);
    } catch (err) {
      console.error('[alerts] Farm messages failed:', err instanceof Error ? err.message : err);
    }
    // Instant low-feed alerts (a farm's feed in use reached its minimum) are independent too.
    try {
      const lowFeed = await lowFeedAlertService.run();
      if (lowFeed.sent > 0) console.log(`[alerts] Sent ${lowFeed.sent} low-feed alert(s).`);
    } catch (err) {
      console.error('[alerts] Low-feed check failed:', err instanceof Error ? err.message : err);
    }
    // Cattle-limit warnings are independent of the sale alerts: one failing must not stop the other.
    try {
      const capacity = await capacityAlertService.run();
      if (capacity.sent > 0) console.log(`[alerts] Sent ${capacity.sent} cattle-limit warning(s).`);
    } catch (err) {
      console.error('[alerts] Cattle-limit check failed:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };
  void heartbeat();
  setTimeout(tick, FIRST_DELAY_MS);
  setInterval(tick, EVERY_MS);
  console.log('[alerts] Scheduler started: checking every 10 minutes.');
}
