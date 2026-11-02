import 'server-only';
import { randomUUID } from 'crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Form entries that could not be handed to CC Livestock (its API or database was down) wait here, one JSON file
 * each, and are sent again once it answers (see flushOutbox in db.ts). The visitor is told the request was received,
 * so nothing they typed is lost. The files hold names and phone numbers: the folder is private to this server
 * (0700/0600), ignored by git, and each file is deleted as soon as it is delivered.
 */
export type OutboxKind = 'application' | 'inquiry';
export interface OutboxItem { kind: OutboxKind; payload: unknown; queuedAt: string }

const MAX_ITEMS = 500;
const MAX_BYTES = 300 * 1024 * 1024;

export function outboxDir(): string {
  const dir = process.env.CAMCOW_OUTBOX_DIR?.trim();
  return dir ? path.resolve(dir) : path.resolve('.outbox');
}
const failedDir = () => path.join(outboxDir(), 'failed');

async function names(): Promise<string[]> {
  try {
    return (await readdir(outboxDir())).filter(n => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

/** Keeps one entry to send later. Refuses when the folder is full (the visitor then sees "try again, or call us"). */
export async function enqueue(kind: OutboxKind, payload: unknown): Promise<void> {
  const list = await names();
  let bytes = 0;
  for (const n of list) bytes += (await stat(path.join(outboxDir(), n)).catch(() => ({ size: 0 }))).size;
  if (list.length >= MAX_ITEMS || bytes >= MAX_BYTES) throw new Error('The waiting list for form entries is full.');
  await mkdir(outboxDir(), { recursive: true, mode: 0o700 });
  const item: OutboxItem = { kind, payload, queuedAt: new Date().toISOString() };
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.json`;
  await writeFile(path.join(outboxDir(), name), JSON.stringify(item), { mode: 0o600 });
}

/** The waiting entries, oldest first. A file that cannot be read is moved aside, not retried forever. */
export async function waiting(): Promise<{ name: string; item: OutboxItem }[]> {
  const out: { name: string; item: OutboxItem }[] = [];
  for (const name of await names()) {
    try {
      out.push({ name, item: JSON.parse(await readFile(path.join(outboxDir(), name), 'utf8')) as OutboxItem });
    } catch {
      await park(name);
    }
  }
  return out;
}

export async function remove(name: string): Promise<void> {
  await rm(path.join(outboxDir(), name), { force: true });
}

/** An entry CC Livestock refused (it would never be accepted): kept in failed/ for a person to look at. */
export async function park(name: string): Promise<void> {
  await mkdir(failedDir(), { recursive: true, mode: 0o700 });
  await rename(path.join(outboxDir(), name), path.join(failedDir(), name)).catch(() => undefined);
}

/** How many entries wait, and for how long the oldest has waited (health check). */
export async function outboxStatus(now = Date.now()): Promise<{ waiting: number; oldestMinutes: number | null; refused: number }> {
  const list = await names();
  const refused = await readdir(failedDir()).then(l => l.filter(n => n.endsWith('.json')).length).catch(() => 0);
  const first = list[0] ? Number(list[0].split('-')[0]) : NaN;
  return { waiting: list.length, oldestMinutes: Number.isFinite(first) ? Math.max(0, Math.floor((now - first) / 60_000)) : null, refused };
}
