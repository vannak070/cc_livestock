import { readFile } from 'fs/promises';
import path from 'path';

let cached: string | undefined;

/**
 * Which release of CC Livestock this server runs: Next's build id (.next/BUILD_ID, new for every `next build`).
 * Server only. "unknown" when there is none (e.g. while building), which the update check ignores.
 */
export async function currentAppVersion(): Promise<string> {
  if (cached) return cached;
  try {
    cached = (await readFile(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8')).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
  return cached;
}
