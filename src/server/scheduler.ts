import { capacityAlertService } from '../services/capacity-alert.service';
import { saleAlertService } from '../services/sale-alert.service';
import { telegramService } from '../services/telegram.service';

const EVERY_MS = 10 * 60 * 1000;
const FIRST_DELAY_MS = 30 * 1000;

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
    try {
      const result = await saleAlertService.run();
      if (result.sent > 0) console.log(`[alerts] Sent a Telegram alert for ${result.sent} batch(es).`);
    } catch (err) {
      console.error('[alerts] Check failed:', err instanceof Error ? err.message : err);
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
  setTimeout(tick, FIRST_DELAY_MS);
  setInterval(tick, EVERY_MS);
  console.log('[alerts] Scheduler started: checking every 10 minutes.');
}
