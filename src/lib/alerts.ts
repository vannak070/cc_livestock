/**
 * Settings for alerts sent outside the app (Telegram). The bot token is a
 * secret and lives only in the server's environment, never in these settings.
 */

export interface AlertSettings {
  /** Master switch: nothing is sent while this is off. */
  telegramEnabled?: boolean;
  /** The Telegram group (or channel) that receives the alerts. */
  chatId?: string;
  /** Hour of the day (0 to 23, farm time) the daily alert is sent. */
  sendHour?: number;
}

export const DEFAULT_SEND_HOUR = 7;

/** The alert settings with their defaults filled in. */
export function alertSettings(settings: { alerts?: AlertSettings } | null | undefined): Required<AlertSettings> {
  const a = settings?.alerts ?? {};
  return {
    telegramEnabled: a.telegramEnabled === true,
    chatId: typeof a.chatId === 'string' ? a.chatId.trim() : '',
    sendHour: Number.isInteger(a.sendHour) && (a.sendHour as number) >= 0 && (a.sendHour as number) <= 23 ? (a.sendHour as number) : DEFAULT_SEND_HOUR,
  };
}

/** A Telegram chat id: a number (groups are negative) or an @channelname. */
export const isChatId = (value: string): boolean => /^-?\d{5,20}$/.test(value) || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value);

/** Why the alert settings cannot be saved, or null. */
export function alertSettingsProblem(input: AlertSettings | undefined): string | null {
  if (!input || typeof input !== 'object') return 'The alert settings are missing.';
  if (input.sendHour !== undefined && !(Number.isInteger(input.sendHour) && input.sendHour >= 0 && input.sendHour <= 23)) return 'Choose an hour from 0 to 23.';
  const chat = (input.chatId ?? '').trim();
  if (chat && !isChatId(chat)) return 'That does not look like a Telegram chat id. Use "Find my group" to fill it in.';
  if (input.telegramEnabled && !chat) return 'Choose the Telegram group before switching alerts on.';
  return null;
}

/** Telegram messages use a small HTML subset; user text must not be read as tags. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
