import { mkdir, readFile, readdir, rename, rm, writeFile } from 'fs/promises';
import path from 'path';
import type { Actor } from '../../lib/authz';
import { buildPublicSnapshot, fieldsOutsideAllowList, type PublicSnapshot } from '../../lib/website';
import { websitePhotoRepository } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';
import { loadWebsiteData } from './website-data';

/**
 * Publishes the public snapshot for the CamCow website (SFD sections 4 and 5).
 *
 * Folder layout (WEBSITE_SNAPSHOT_DIR, default ./.website-snapshot):
 *   latest.json                  what the website reads
 *   history/<time>.json          the last 7 snapshots, for rollback
 *   photos/<id>-small.<ext>      only photos the snapshot uses; others are removed
 *   photos/<id>-large.<ext>
 *
 * The snapshot is refused (and the previous one stays live) if it carries any
 * field outside the allow-list.
 */
export const SNAPSHOT_HISTORY = 7;

export function snapshotDir(): string {
  return path.resolve(process.env.WEBSITE_SNAPSHOT_DIR?.trim() || '.website-snapshot');
}

const extOf = (mime: string) => (mime === 'image/jpeg' ? 'jpg' : 'webp');

/** Every photo id the snapshot shows. */
export function photosIn(s: PublicSnapshot): string[] {
  return [...new Set([...s.farms.flatMap(f => f.photoIds), ...s.cattle.map(l => l.photoId), ...s.news.map(n => n.photoId)].filter((x): x is string => !!x))];
}

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

export interface PublishResult {
  builtAt: string;
  farms: number;
  cattle: number;
  news: number;
  photos: number;
}

export class SnapshotPublisherService {
  private running: Promise<PublishResult> | null = null;

  /** Builds and writes the snapshot. Calls that arrive while one runs share its result. */
  async publish(): Promise<PublishResult> {
    if (!this.running) this.running = this.doPublish().finally(() => { this.running = null; });
    return this.running;
  }

  /** "Publish now" on the Preview tab. Super Admin and Admin only. */
  async publishAs(actor: Actor): Promise<PublishResult> {
    assertWebsiteAdmin(actor);
    return this.publish();
  }

  /** Publishes in the background after an office change; a failure only logs (the scheduler retries). */
  publishSoon(): void {
    void this.publish().catch(err => console.error('[website] Snapshot publish failed:', err instanceof Error ? err.message : err));
  }

  /** When the live snapshot was built, or null when none has been published yet. */
  async lastBuiltAt(): Promise<string | null> {
    try {
      const s = JSON.parse(await readFile(path.join(snapshotDir(), 'latest.json'), 'utf8')) as PublicSnapshot;
      return s.builtAt ?? null;
    } catch {
      return null;
    }
  }

  private async doPublish(): Promise<PublishResult> {
    const snapshot = buildPublicSnapshot(await loadWebsiteData());
    const extra = fieldsOutsideAllowList(snapshot);
    if (extra.length) throw new Error(`Snapshot refused: fields outside the allow-list (${extra.join(', ')}).`);

    const dir = snapshotDir();
    const photoDir = path.join(dir, 'photos');
    const historyDir = path.join(dir, 'history');
    await mkdir(photoDir, { recursive: true });
    await mkdir(historyDir, { recursive: true });

    // Photos first, so the website never points at a file that is not there yet.
    const wanted = photosIn(snapshot);
    const keep = new Set<string>();
    const existing = new Set(await readdir(photoDir));
    for (const id of wanted) {
      for (const size of ['small', 'large'] as const) {
        const photo = await websitePhotoRepository.bytes(id, size);
        if (!photo) continue;
        const name = `${id}-${size}.${extOf(photo.mime)}`;
        keep.add(name);
        if (!existing.has(name)) await writeAtomic(path.join(photoDir, name), new Uint8Array(photo.data));
      }
    }

    const json = JSON.stringify(snapshot, null, 2);
    await writeAtomic(path.join(historyDir, `${snapshot.builtAt.replace(/[:.]/g, '-')}.json`), json);
    await writeAtomic(path.join(dir, 'latest.json'), json);

    // Tidy up: photos no longer shown, and old history.
    for (const name of existing) if (!keep.has(name) && !name.includes('.tmp-')) await rm(path.join(photoDir, name), { force: true });
    const history = (await readdir(historyDir)).filter(n => n.endsWith('.json')).sort();
    for (const old of history.slice(0, Math.max(0, history.length - SNAPSHOT_HISTORY))) await rm(path.join(historyDir, old), { force: true });

    return { builtAt: snapshot.builtAt, farms: snapshot.farms.length, cattle: snapshot.cattle.length, news: snapshot.news.length, photos: wanted.length };
  }
}

export const snapshotPublisherService = new SnapshotPublisherService();
