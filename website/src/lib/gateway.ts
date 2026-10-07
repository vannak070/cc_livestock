import 'server-only';

/**
 * The link to CC Livestock. When CAMCOW_API_URL is set, this site reads the
 * published snapshot and its photos from CC Livestock's website gateway and
 * sends its form entries and visit counts there, so it needs neither a shared
 * folder nor a database account. CAMCOW_API_KEY is the shared secret
 * (WEBSITE_API_KEY on the CC Livestock side). Without CAMCOW_API_URL the site
 * works as before: it reads ../.website-snapshot and writes with FORMS_DATABASE_URL.
 */

/** Reads should be quick; a form with photos may take longer to upload. */
export const READ_TIMEOUT_MS = 8_000;
export const SEND_TIMEOUT_MS = 20_000;

/** Whether the site is linked to CC Livestock through the gateway. */
export const gatewayOn = (): boolean => (process.env.CAMCOW_API_URL ?? '').trim() !== '';

const baseUrl = () => (process.env.CAMCOW_API_URL ?? '').trim().replace(/\/+$/, '');

function apiKey(): string {
  const key = (process.env.CAMCOW_API_KEY ?? '').trim();
  if (!key) throw new Error('CAMCOW_API_KEY is not set.');
  return key;
}

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** Calls the gateway with the key. Errors never contain the key. */
export async function callGateway(path: string, options: CallOptions = {}): Promise<Response> {
  const key = apiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? READ_TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('CC Livestock did not answer in time.');
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach CC Livestock: ${message.split(key).join('[key]')}`);
  } finally {
    clearTimeout(timer);
  }
}
