import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import { callGateway, gatewayOn } from '../gateway';
import type { PublicSnapshot } from './types';

/**
 * The latest public snapshot, from CC Livestock. Two ways, chosen by
 * CAMCOW_API_URL (see lib/gateway.ts):
 *  - API: asked from CC Livestock's website gateway; "has it changed?" is a
 *    cheap request (ETag). If CC Livestock cannot be reached, the last good
 *    copy keeps being shown, and a failed call is not repeated for a few seconds.
 *  - Folder: read from ../.website-snapshot (this app lives in CC Livestock's
 *    website/ folder), or CAMCOW_SNAPSHOT_DIR.
 * Either way it is cached for 30 seconds. With no snapshot yet, the site still
 * works and shows empty states.
 */
const CACHE_MS = 30_000;
/** After a failed call, serve what we have for this long before trying again. */
const RETRY_AFTER_FAILURE_MS = 10_000;

let cache: { at: number; snapshot: PublicSnapshot } | null = null;
let etag: string | null = null;
let failedAt = 0;

export const EMPTY_SNAPSHOT: PublicSnapshot = {
  version: 1,
  builtAt: '',
  summary: { memberFarms: '0', provinces: 0, cattleRaised: '0', feedRecordedTodayPct: null },
  farms: [],
  cattle: [],
  news: [],
};

const usable = (s: unknown): s is PublicSnapshot => !!s && (s as PublicSnapshot).version === 1 && Array.isArray((s as PublicSnapshot).farms);

/** CAMCOW_SNAPSHOT_DIR, or else CC Livestock's own .website-snapshot (this app lives in its website/ folder). */
export function snapshotDir(): string {
  const dir = process.env.CAMCOW_SNAPSHOT_DIR?.trim();
  return dir ? path.resolve(dir) : path.resolve('..', '.website-snapshot');
}

async function fromGateway(): Promise<PublicSnapshot> {
  const res = await callGateway('/snapshot', { headers: etag && cache ? { 'If-None-Match': etag } : {} });
  if (res.status === 304 && cache) return cache.snapshot;
  if (!res.ok) throw new Error(`CC Livestock answered ${res.status}.`);
  const parsed: unknown = await res.json();
  if (!usable(parsed)) throw new Error('CC Livestock sent a snapshot this site does not understand.');
  etag = res.headers.get('etag');
  return parsed;
}

async function fromFolder(): Promise<PublicSnapshot> {
  const parsed: unknown = JSON.parse(await readFile(path.join(snapshotDir(), 'latest.json'), 'utf8'));
  return usable(parsed) ? parsed : EMPTY_SNAPSHOT;
}

export async function getSnapshot(): Promise<PublicSnapshot> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.snapshot;
  if (gatewayOn()) {
    if (now - failedAt < RETRY_AFTER_FAILURE_MS) return cache?.snapshot ?? EMPTY_SNAPSHOT;
    try {
      const snapshot = await fromGateway();
      cache = { at: Date.now(), snapshot };
      failedAt = 0;
      return snapshot;
    } catch (err) {
      failedAt = now;
      console.error('[snapshot] Could not get the snapshot from CC Livestock:', err instanceof Error ? err.message : err);
      return cache?.snapshot ?? EMPTY_SNAPSHOT; // the last good copy, or empty states
    }
  }
  try {
    const snapshot = await fromFolder();
    cache = { at: now, snapshot };
    return snapshot;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

const PHOTO_KEY = /^[A-Z0-9-]+-(small|large)$/;
const PHOTO_CACHE_MS = 5 * 60_000;
const PHOTO_CACHE_MAX = 60;
const photoCache = new Map<string, { at: number; photo: { data: Buffer; type: string } }>();

/**
 * A photo from the snapshot by "<id>-small" or "<id>-large" (CC Livestock
 * writes .webp, or .jpg for photos taken on Safari). Only names of that shape
 * are accepted, so no other file can be read.
 */
export async function readPhoto(key: string): Promise<{ data: Buffer; type: string } | null> {
  if (!PHOTO_KEY.test(key)) return null;
  if (gatewayOn()) {
    const hit = photoCache.get(key);
    if (hit && Date.now() - hit.at < PHOTO_CACHE_MS) return hit.photo;
    try {
      const res = await callGateway(`/photos/${key}`);
      if (!res.ok) return null;
      const photo = { data: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? 'image/webp' };
      if (photoCache.size >= PHOTO_CACHE_MAX) photoCache.delete(photoCache.keys().next().value as string);
      photoCache.set(key, { at: Date.now(), photo });
      return photo;
    } catch (err) {
      console.error('[snapshot] Could not get a photo from CC Livestock:', err instanceof Error ? err.message : err);
      return null;
    }
  }
  for (const [ext, type] of [['webp', 'image/webp'], ['jpg', 'image/jpeg']] as const) {
    try {
      return { data: await readFile(path.join(snapshotDir(), 'photos', `${key}.${ext}`)), type };
    } catch {
      // try the other type
    }
  }
  return null;
}
