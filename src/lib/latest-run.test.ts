import { describe, it, expect } from 'vitest';
import { latestRun } from './latest-run';

/** A job whose runs finish only when the test says so. */
function gatedJob() {
  const runs: { started: number; finish: (v?: string) => void; fail: (e: Error) => void }[] = [];
  let state = 'v0';
  const job = () => new Promise<string>((resolve, reject) => {
    const seen = state; // what the run "read" when it started
    runs.push({ started: runs.length + 1, finish: () => resolve(seen), fail: reject });
  });
  return { job, runs, setState: (s: string) => { state = s; } };
}

describe('latestRun', () => {
  it('starts at once when idle', async () => {
    const g = gatedJob();
    const run = latestRun(g.job);
    const p = run();
    expect(g.runs.length).toBe(1);
    g.runs[0].finish();
    expect(await p).toBe('v0');
  });

  it('a change made while a run is in progress is picked up by a follow-up run', async () => {
    const g = gatedJob();
    const run = latestRun(g.job);
    const first = run();                 // starts, reads v0
    g.setState('v1');                    // a change is saved while it runs
    const second = run();                // asks for a publish: must NOT just join the first
    expect(g.runs.length).toBe(1);       // the follow-up waits for the first to finish
    g.runs[0].finish();
    expect(await first).toBe('v0');
    await Promise.resolve(); await Promise.resolve();
    expect(g.runs.length).toBe(2);       // follow-up started after the first finished
    g.runs[1].finish();
    expect(await second).toBe('v1');     // and it saw the change
  });

  it('many requests during one run share a single follow-up', async () => {
    const g = gatedJob();
    const run = latestRun(g.job);
    run();
    const a = run(); const b = run(); const c = run();
    expect(a).toBe(b); expect(b).toBe(c);
    g.runs[0].finish();
    await new Promise(r => setTimeout(r, 0));
    expect(g.runs.length).toBe(2);
    g.runs[1].finish();
    await Promise.all([a, b, c]);
    expect(g.runs.length).toBe(2);
  });

  it('a failed run still lets the follow-up happen, and the next request starts fresh', async () => {
    const g = gatedJob();
    const run = latestRun(g.job);
    const first = run();
    const second = run();
    first.catch(() => undefined);
    g.runs[0].fail(new Error('disk full'));
    await expect(first).rejects.toThrow('disk full');
    await Promise.resolve(); await Promise.resolve();
    g.runs[1].finish();
    expect(await second).toBe('v0');
    const third = run();
    expect(g.runs.length).toBe(3);
    g.runs[2].finish();
    await third;
  });
});
