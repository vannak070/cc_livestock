import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import type { PublicSnapshot } from './types';

/**
 * Reads the latest public snapshot from snapshotDir() (written by
 * CC Livestock every 15 minutes and after each office change). Cached for
 * 30 seconds. With no snapshot yet, the site still works and shows empty states.
 */
const CACHE_MS = 30_000;
let cache: { at: number; snapshot: PublicSnapshot } | null = null;

export const EMPTY_SNAPSHOT: PublicSnapshot = {
  version: 1,
  builtAt: '',
  summary: { memberFarms: '0', provinces: 0, cattleRaised: '0', feedRecordedTodayPct: null },
  farms: [],
  cattle: [],
  news: [],
};

/** CAMCOW_SNAPSHOT_DIR, or else CC Livestock's own .website-snapshot (this app lives in its website/ folder). */
export function snapshotDir(): string {
  const dir = process.env.CAMCOW_SNAPSHOT_DIR?.trim();
  return dir ? path.resolve(dir) : path.resolve('..', '.website-snapshot');
}

export async function getSnapshot(): Promise<PublicSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.snapshot;
  try {
    const parsed = JSON.parse(await readFile(path.join(snapshotDir(), 'latest.json'), 'utf8')) as PublicSnapshot;
    const snapshot = parsed?.version === 1 && Array.isArray(parsed.farms) ? parsed : EMPTY_SNAPSHOT;
    cache = { at: Date.now(), snapshot };
    return snapshot;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

const PHOTO_KEY = /^[A-Z0-9-]+-(small|large)$/;

/**
 * A photo from the snapshot's photos folder by "<id>-small" or "<id>-large"
 * (the publisher writes .webp, or .jpg for photos taken on Safari). Only
 * names of that shape are accepted, so no other file can be read.
 */
export async function readPhoto(key: string): Promise<{ data: Buffer; type: string } | null> {
  if (!PHOTO_KEY.test(key)) return null;
  for (const [ext, type] of [['webp', 'image/webp'], ['jpg', 'image/jpeg']] as const) {
    try {
      return { data: await readFile(path.join(snapshotDir(), 'photos', `${key}.${ext}`)), type };
    } catch {
      // try the other type
    }
  }
  return null;
}
