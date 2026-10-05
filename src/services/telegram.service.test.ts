import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramService } from './telegram.service';

const TOKEN = '111111:SECRET-TOKEN-VALUE';
const reply = (body: unknown, status = 200) => ({ status, json: async () => body }) as Response;

describe('TelegramService', () => {
  const service = new TelegramService();
  beforeEach(() => { process.env.TELEGRAM_BOT_TOKEN = TOKEN; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.TELEGRAM_BOT_TOKEN; });

  it('says it is not configured without a token, and refuses to call out', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(service.isConfigured()).toBe(false);
    await expect(service.bot()).rejects.toThrow(/not set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an HTML message to the chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ ok: true, result: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await service.send('-1001234567890', '<b>Hi</b>');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '-1001234567890', text: '<b>Hi</b>', parse_mode: 'HTML' });
  });

  it('refuses a bad chat id before calling Telegram', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(service.send('not-an-id', 'x')).rejects.toThrow(/chat id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shortens a message that is too long', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ ok: true, result: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await service.send('-1001234567890', 'x'.repeat(5000));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text.length).toBeLessThanOrEqual(4000);
  });

  it('reports what Telegram said when it refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ok: false, description: 'Forbidden: bot was kicked from the group chat' }, 403)));
    await expect(service.send('-1001234567890', 'x')).rejects.toThrow('bot was kicked');
  });

  it('never puts the token in an error, even if the network layer does', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`getaddrinfo failed for https://api.telegram.org/bot${TOKEN}/sendMessage`)));
    const err = await service.send('-1001234567890', 'x').catch((e: Error) => e);
    expect((err as Error).message).not.toContain(TOKEN);
    expect((err as Error).message).toContain('[token]');
  });

  it('lists chats the bot has seen, groups before people, without duplicates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ok: true, result: [
      { message: { chat: { id: 5, type: 'private', first_name: 'Sam' } } },
      { my_chat_member: { chat: { id: -100999, type: 'supergroup', title: 'Management' } } },
      { message: { chat: { id: -100999, type: 'supergroup', title: 'Management' } } },
      { edited_message: {} },
    ] })));
    expect(await service.chats()).toEqual([
      { id: '-100999', type: 'supergroup', title: 'Management' },
      { id: '5', type: 'private', title: 'Sam' },
    ]);
  });
});
