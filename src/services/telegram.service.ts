import { isChatId } from '../lib/alerts';

/**
 * Talks to the Telegram Bot API. The token comes from the server's
 * environment (TELEGRAM_BOT_TOKEN) and is never returned to the browser,
 * logged, or included in an error message.
 */

const TIMEOUT_MS = 10_000;
const MAX_TEXT = 4000; // Telegram allows 4096 characters

export interface TelegramChat { id: string; type: string; title: string }
export interface TelegramBot { username: string; name: string }

const token = () => (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

/** Error text without the token, whatever the network layer put in it. */
function clean(message: string): string {
  const t = token();
  return t ? message.split(t).join('[token]') : message;
}

export class TelegramService {
  isConfigured(): boolean {
    return token().length > 0;
  }

  /**
   * True on servers meant to send real alerts: production, or when
   * ALERTS_SCHEDULER=on. Keeps development from messaging the real group by accident.
   */
  sendingAllowedHere(): boolean {
    return process.env.NODE_ENV === 'production' || process.env.ALERTS_SCHEDULER === 'on';
  }

  private async call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) throw new Error('The Telegram bot token is not set on the server (TELEGRAM_BOT_TOKEN).');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
      if (!data?.ok) throw new Error(data?.description ?? `Telegram answered ${res.status}`);
      return data.result as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw new Error('Telegram did not answer in time. Try again.');
      throw new Error(`Telegram: ${clean(err instanceof Error ? err.message : String(err))}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Who the bot is; also proves the token works. */
  async bot(): Promise<TelegramBot> {
    const r = await this.call<{ username: string; first_name: string }>('getMe');
    return { username: r.username, name: r.first_name };
  }

  /** Groups and chats the bot has been added to or messaged in recently. */
  async chats(): Promise<TelegramChat[]> {
    const updates = await this.call<Record<string, { chat?: { id: number; type: string; title?: string; username?: string; first_name?: string } } | undefined>[]>(
      'getUpdates', { limit: 100, allowed_updates: ['message', 'my_chat_member', 'channel_post'] }
    );
    const found = new Map<string, TelegramChat>();
    for (const u of updates) {
      const chat = (u.message ?? u.my_chat_member ?? u.channel_post)?.chat;
      if (!chat) continue;
      found.set(String(chat.id), { id: String(chat.id), type: chat.type, title: chat.title ?? chat.username ?? chat.first_name ?? String(chat.id) });
    }
    // A group is what we want; people who messaged the bot privately are listed last.
    return [...found.values()].sort((a, b) => Number(a.type === 'private') - Number(b.type === 'private'));
  }

  /** Sends one message (Telegram HTML). */
  async send(chatId: string, html: string): Promise<void> {
    if (!isChatId(chatId)) throw new Error('The Telegram chat id is not valid.');
    await this.call('sendMessage', {
      chat_id: chatId,
      text: html.length > MAX_TEXT ? `${html.slice(0, MAX_TEXT - 1)}…` : html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }
}

export const telegramService = new TelegramService();
