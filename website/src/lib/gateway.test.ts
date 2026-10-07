import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const KEY = 'website-test-key-'.padEnd(48, 'x');
const URL_BASE = 'http://office.example/api/v1/site';
const snap = (builtAt: string) => ({ version: 1, builtAt, summary: { memberFarms: '0', provinces: 0, cattleRaised: '0', feedRecordedTodayPct: null }, farms: [{ slug: 'a' }], cattle: [], news: [] });
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }, ...init });

let fetchMock: ReturnType<typeof vi.fn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T00:00:00Z'));
  process.env.CAMCOW_API_URL = `${URL_BASE}/`;
  process.env.CAMCOW_API_KEY = KEY;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.CAMCOW_API_URL;
  delete process.env.CAMCOW_API_KEY;
});

describe('the gateway client', () => {
  it('is on only when CAMCOW_API_URL is set', async () => {
    const { gatewayOn } = await import('./gateway');
    expect(gatewayOn()).toBe(true);
    process.env.CAMCOW_API_URL = '  ';
    expect(gatewayOn()).toBe(false);
    delete process.env.CAMCOW_API_URL;
    expect(gatewayOn()).toBe(false);
  });

  it('calls the right address with the key', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    const { callGateway } = await import('./gateway');
    await callGateway('/ping');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL_BASE}/ping`);
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
  });

  it('refuses to call without a key', async () => {
    delete process.env.CAMCOW_API_KEY;
    const { callGateway } = await import('./gateway');
    await expect(callGateway('/ping')).rejects.toThrow('CAMCOW_API_KEY is not set');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never puts the key in an error', async () => {
    fetchMock.mockRejectedValue(new Error(`connect ECONNREFUSED while sending ${KEY}`));
    const { callGateway } = await import('./gateway');
    const err = await callGateway('/ping').catch((e: Error) => e);
    expect((err as Error).message).not.toContain(KEY);
    expect((err as Error).message).toContain('Could not reach CC Livestock');
  });

  it('gives up when CC Livestock does not answer in time', async () => {
    fetchMock.mockImplementation((_u: string, init: RequestInit) => new Promise((_res, rej) => { init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }));
    const { callGateway } = await import('./gateway');
    const pending = callGateway('/snapshot', { timeoutMs: 1000 }).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect(((await pending) as Error).message).toBe('CC Livestock did not answer in time.');
  });
});

describe('the snapshot through the gateway', () => {
  it('fetches it once and serves it from memory for 30 seconds', async () => {
    fetchMock.mockResolvedValue(json(snap('A'), { headers: { ETag: '"e1"' } }));
    const { getSnapshot } = await import('./snapshot/read');
    expect((await getSnapshot()).builtAt).toBe('A');
    await vi.advanceTimersByTimeAsync(20_000);
    await getSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks "has it changed?" afterwards and keeps its copy on 304', async () => {
    fetchMock.mockResolvedValueOnce(json(snap('A'), { headers: { ETag: '"e1"' } }));
    const { getSnapshot } = await import('./snapshot/read');
    await getSnapshot();
    await vi.advanceTimersByTimeAsync(31_000);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    expect((await getSnapshot()).builtAt).toBe('A');
    expect(fetchMock.mock.calls[1][1].headers['If-None-Match']).toBe('"e1"');
    await vi.advanceTimersByTimeAsync(31_000);
    fetchMock.mockResolvedValueOnce(json(snap('B'), { headers: { ETag: '"e2"' } }));
    expect((await getSnapshot()).builtAt).toBe('B');
  });

  it('keeps showing the last good copy when CC Livestock is down, and does not hammer it', async () => {
    fetchMock.mockResolvedValueOnce(json(snap('A'), { headers: { ETag: '"e1"' } }));
    const { getSnapshot } = await import('./snapshot/read');
    await getSnapshot();
    await vi.advanceTimersByTimeAsync(31_000);
    fetchMock.mockRejectedValue(new Error('down'));
    expect((await getSnapshot()).builtAt).toBe('A');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await getSnapshot(); await getSnapshot();                       // inside the 10 second pause
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(11_000);
    await getSnapshot();                                            // tries again
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports an outage once, as a warning, not on every page', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const { getSnapshot } = await import('./snapshot/read');
    await getSnapshot();
    await vi.advanceTimersByTimeAsync(11_000);
    await getSnapshot();
    await vi.advanceTimersByTimeAsync(11_000);
    await getSnapshot();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('npm run server');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('shows empty states when there is no copy at all and CC Livestock is down', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const { getSnapshot, EMPTY_SNAPSHOT } = await import('./snapshot/read');
    expect(await getSnapshot()).toBe(EMPTY_SNAPSHOT);
  });

  it('does not trust an answer it does not understand', async () => {
    fetchMock.mockResolvedValue(json({ hello: 'world' }));
    const { getSnapshot, EMPTY_SNAPSHOT } = await import('./snapshot/read');
    expect(await getSnapshot()).toBe(EMPTY_SNAPSHOT);
  });

  it('recovers after CC Livestock comes back', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down'));
    const { getSnapshot } = await import('./snapshot/read');
    await getSnapshot();
    await vi.advanceTimersByTimeAsync(11_000);
    fetchMock.mockResolvedValueOnce(json(snap('A'), { headers: { ETag: '"e1"' } }));
    expect((await getSnapshot()).builtAt).toBe('A');
  });
});

describe('photos through the gateway', () => {
  it('asks only for names of the right shape', async () => {
    const { readPhoto } = await import('./snapshot/read');
    for (const bad of ['../secret', 'photo-a-small', 'PHOTO-A-huge', 'PHOTO-A-small.webp', '']) expect(await readPhoto(bad)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the bytes and type, then serves repeats from memory', async () => {
    fetchMock.mockResolvedValue(new Response(Buffer.from('bytes'), { status: 200, headers: { 'Content-Type': 'image/webp' } }));
    const { readPhoto } = await import('./snapshot/read');
    const first = await readPhoto('PHOTO-ABC123-small');
    expect(first!.type).toBe('image/webp');
    expect(first!.data.toString()).toBe('bytes');
    await readPhoto('PHOTO-ABC123-small');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${URL_BASE}/photos/PHOTO-ABC123-small`);
  });

  it('says not found when CC Livestock has no such photo or cannot be reached', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    const { readPhoto } = await import('./snapshot/read');
    expect(await readPhoto('PHOTO-NONE-small')).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await readPhoto('PHOTO-OTHER-small')).toBeNull();
  });
});

describe('form entries through the gateway', () => {
  const app = { name: 'Sokha', phone: '012345678', province: 'Kandal', district: 'Kien Svay', landM2: null, cattleNow: 3, hasPens: true, consent: true as const, language: 'en' as const };

  it('posts an application with its photos as text', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    const { insertApplication } = await import('./forms/db');
    await insertApplication(app, [{ mime: 'image/webp', large: Buffer.from('LARGE'), small: Buffer.from('SMALL'), width: 800, height: 600 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${URL_BASE}/applications`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ name: 'Sokha', province: 'Kandal', consent: true });
    expect(body.photos).toEqual([{ mime: 'image/webp', large: Buffer.from('LARGE').toString('base64'), small: Buffer.from('SMALL').toString('base64'), width: 800, height: 600 }]);
  });

  it('posts an inquiry and a visit count (with the device)', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { insertInquiry, insertEvent } = await import('./forms/db');
    await insertInquiry({ kind: 'price', name: 'Buyer', phone: '012345678', buyerType: 'trader', quantity: 2, weightClass: '', listingId: null, message: '', language: 'km' });
    await insertEvent({ kind: 'view', path: '/cattle', lang: 'en', referrer: '' }, 'phone');
    expect(fetchMock.mock.calls[0][0]).toBe(`${URL_BASE}/inquiries`);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ kind: 'view', path: '/cattle', lang: 'en', referrer: '', device: 'phone' });
  });

  it('fails (so the visitor sees "try again") when CC Livestock refuses or is down', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: false, field: 'phone' }, { status: 400 }));
    const { insertApplication, insertInquiry } = await import('./forms/db');
    await expect(insertApplication(app)).rejects.toThrow('answered 400');
    fetchMock.mockRejectedValueOnce(new Error('down'));
    await expect(insertInquiry({ kind: 'notify', name: 'B', phone: '012345678', buyerType: '', quantity: null, weightClass: '', listingId: null, message: '', language: 'en' })).rejects.toThrow('Could not reach CC Livestock');
  });
});
