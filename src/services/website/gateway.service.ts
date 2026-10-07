import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { snapshotDir } from './snapshot-publisher.service';

/** What the public website is allowed to read: the published snapshot and the photos it shows. Nothing else. */

/** Same shape as an empty snapshot, so the site shows its empty states before anything is published. */
const EMPTY = JSON.stringify({ version: 1, builtAt: '', summary: { memberFarms: '0', provinces: 0, cattleRaised: '0', feedRecordedTodayPct: null }, farms: [], cattle: [], news: [] });

export interface SnapshotAnswer { body: string; etag: string; published: boolean }

const etagOf = (body: string) => `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"`;

export async function readSnapshot(): Promise<SnapshotAnswer> {
  try {
    const body = await readFile(path.join(snapshotDir(), 'latest.json'), 'utf8');
    JSON.parse(body); // never hand out a half-written or damaged file
    return { body, etag: etagOf(body), published: true };
  } catch {
    return { body: EMPTY, etag: etagOf(EMPTY), published: false };
  }
}

/** "<id>-small" or "<id>-large": only names of this shape are accepted, so no other file can be read. */
export const PHOTO_KEY = /^[A-Z0-9-]+-(small|large)$/;

export async function readSnapshotPhoto(key: string): Promise<{ data: Buffer; type: string } | null> {
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
