/**
 * Wraps a job so that overlapping requests never lose a change.
 *
 * - Idle: the job starts at once.
 * - Busy: the running job may have read its data before this request's change
 *   was saved, so one more run is queued for after it. Every request that
 *   arrives while a job runs shares that single follow-up run, and gets its
 *   result: the follow-up always starts after the request was made.
 */
export function latestRun<T>(job: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  let queued: Promise<T> | null = null;

  const start = (): Promise<T> => {
    const p = job().finally(() => { if (running === p) running = null; });
    running = p;
    return p;
  };

  return () => {
    if (!running) return start();
    if (!queued) {
      queued = running.then(() => undefined, () => undefined).then(() => {
        queued = null;
        return start();
      });
    }
    return queued;
  };
}
