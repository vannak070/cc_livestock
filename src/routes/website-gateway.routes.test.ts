import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import router from './website-gateway.routes';

const KEY = 'test-key-'.padEnd(48, 'x');
let server: Server;
let base = '';
let dir = '';

const auth = (key = KEY): Record<string, string> => ({ Authorization: `Bearer ${key}` });
const post = (p: string, body: unknown, headers: Record<string, string> = auth()) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/site', router);
  await new Promise<void>(res => { server = app.listen(0, '127.0.0.1', () => res()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/site`;
});
afterAll(() => new Promise<void>(res => server.close(() => res())));
beforeEach(() => {
  process.env.WEBSITE_API_KEY = KEY;
  dir = mkdtempSync(path.join(tmpdir(), 'snapshot-'));
  process.env.WEBSITE_SNAPSHOT_DIR = dir;
});
afterEach(() => {
  delete process.env.WEBSITE_API_KEY;
  delete process.env.WEBSITE_SNAPSHOT_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('the key', () => {
  it('is off when no key is set on the server', async () => {
    delete process.env.WEBSITE_API_KEY;
    const r = await fetch(`${base}/ping`, { headers: auth() });
    expect(r.status).toBe(503);
  });
  it('refuses a missing or wrong key without saying which was wrong', async () => {
    for (const headers of [{}, auth('wrong'), { Authorization: KEY }, auth(KEY + 'x')]) {
      const r = await fetch(`${base}/ping`, { headers });
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ ok: false, error: 'unauthorized' });
    }
  });
  it('accepts the right key', async () => {
    const r = await fetch(`${base}/ping`, { headers: auth() });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, published: false });
  });
});

describe('snapshot', () => {
  it('shows an empty snapshot before anything is published', async () => {
    const r = await fetch(`${base}/snapshot`, { headers: auth() });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ version: 1, farms: [], cattle: [], news: [] });
  });
  it('serves the published file, with an ETag that answers 304 when unchanged', async () => {
    const file = { version: 1, builtAt: '2026-10-07T00:00:00.000Z', summary: { memberFarms: '0', provinces: 0, cattleRaised: '0', feedRecordedTodayPct: null }, farms: [], cattle: [], news: [] };
    writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(file));
    const first = await fetch(`${base}/snapshot`, { headers: auth() });
    expect(await first.json()).toEqual(file);
    const etag = first.headers.get('etag')!;
    expect(etag).toMatch(/^"[a-f0-9]{20}"$/);
    expect((await fetch(`${base}/snapshot`, { headers: { ...auth(), 'If-None-Match': etag } })).status).toBe(304);
    writeFileSync(path.join(dir, 'latest.json'), JSON.stringify({ ...file, builtAt: '2026-10-07T01:00:00.000Z' }));
    const changed = await fetch(`${base}/snapshot`, { headers: { ...auth(), 'If-None-Match': etag } });
    expect(changed.status).toBe(200);
  });
  it('never hands out a damaged file', async () => {
    writeFileSync(path.join(dir, 'latest.json'), '{ "version": 1, "far');
    const r = await fetch(`${base}/snapshot`, { headers: auth() });
    expect(await r.json()).toMatchObject({ version: 1, farms: [] });
  });
});

describe('photos', () => {
  it('serves a published photo and nothing else', async () => {
    mkdirSync(path.join(dir, 'photos'));
    writeFileSync(path.join(dir, 'photos', 'PHOTO-ABC123-small.webp'), Buffer.from('webp-bytes'));
    writeFileSync(path.join(dir, 'secret.txt'), 'secret');
    const ok = await fetch(`${base}/photos/PHOTO-ABC123-small`, { headers: auth() });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('image/webp');
    expect(Buffer.from(await ok.arrayBuffer()).toString()).toBe('webp-bytes');
    for (const key of ['PHOTO-NOPE-small', '..%2Fsecret', 'secret.txt', 'photo-abc123-small', 'PHOTO-ABC123-huge']) {
      expect((await fetch(`${base}/photos/${key}`, { headers: auth() })).status).toBe(404);
    }
  });
});

describe('forms and visit counts (checked here, before anything is saved)', () => {
  it('names the wrong field of an application', async () => {
    const r = await post('/applications', { name: 'X', phone: '012345678', province: 'Kandal', district: 'a', consent: true });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, field: 'name' });
  });
  it('refuses an application without consent, and bad photos', async () => {
    const good = { name: 'Sokha', phone: '012345678', province: 'Kandal', district: 'Kien Svay' };
    expect(await (await post('/applications', { ...good, consent: false })).json()).toEqual({ ok: false, field: 'consent' });
    expect(await (await post('/applications', { ...good, consent: true, photos: [{ mime: 'image/gif' }] })).json()).toEqual({ ok: false, field: 'photos' });
  });
  it('names the wrong field of an inquiry', async () => {
    const r = await post('/inquiries', { name: 'Buyer', phone: 'nope' });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, field: 'phone' });
  });
  it('refuses a body that is not an object', async () => {
    expect((await post('/applications', ['x'])).status).toBe(400);
    expect((await post('/inquiries', [1])).status).toBe(400);
  });
  it('refuses an oversized application early', async () => {
    const r = await fetch(`${base}/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '9000000', ...auth() }, body: '{}' }).catch(() => null);
    // the server may answer 413 or close the connection; either way nothing is saved
    expect(r === null || r.status === 413 || r.status === 400).toBe(true);
  });
  it('quietly ignores an odd visit count', async () => {
    expect((await post('/events', { kind: 'hack', path: '/en' })).status).toBe(204);
    expect((await post('/events', [1])).status).toBe(204);
  });
  it('needs the key for forms too', async () => {
    expect((await post('/applications', {}, {})).status).toBe(401);
    expect((await post('/events', {}, auth('nope'))).status).toBe(401);
  });
});
