import { flushOutbox } from './lib/forms/db';

/**
 * Node.js only (loaded by instrumentation.ts): every 2 minutes, send form entries that waited in the outbox while
 * CC Livestock could not be reached (they are also sent on the next form or successful data read).
 */
setInterval(() => { void flushOutbox(); }, 2 * 60_000).unref?.();
void flushOutbox(true);
