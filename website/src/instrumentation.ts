/**
 * Runs once when the website server starts. The outbox sender uses the database library and the file system, so it
 * is loaded only in the Node.js runtime: the import sits inside the check, which lets the edge build leave it out.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
