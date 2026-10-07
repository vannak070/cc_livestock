import { describe, expect, it } from 'vitest';
import { afterFailure, afterSuccess, buildPublishFailedMessage, publishAlertDue, publishHealth } from './health';

const now = new Date('2026-10-07T05:00:00Z');

describe('website publishing health', () => {
  it('is never / ok / stale by the last good publish', () => {
    expect(publishHealth(undefined, now).state).toBe('never');
    expect(publishHealth({ lastOkAt: '2026-10-07T04:40:00Z' }, now).state).toBe('ok');
    expect(publishHealth({ lastOkAt: '2026-10-07T04:00:00Z' }, now).state).toBe('stale');
  });

  it('keeps the first failure time of a run and clears it on success', () => {
    const a = afterFailure({ lastOkAt: '2026-10-07T04:00:00Z' }, '2026-10-07T04:15:00Z', 'disk full');
    const b = afterFailure(a, '2026-10-07T04:30:00Z', 'disk full again');
    expect(b.failingSince).toBe('2026-10-07T04:15:00Z');
    expect(publishHealth(b, now)).toMatchObject({ state: 'failing', since: '2026-10-07T04:15:00Z', error: 'disk full again' });
    const c = afterSuccess(b, '2026-10-07T04:45:00Z');
    expect(c.failingSince).toBeNull();
    expect(publishHealth(c, now).state).toBe('ok');
  });

  it('alerts once when failing and once when it works again', () => {
    const failing = afterFailure({}, '2026-10-07T04:15:00Z', 'x');
    expect(publishAlertDue(failing)).toBe('failed');
    const told = { ...failing, failureAlertedAt: '2026-10-07T04:16:00Z' };
    expect(publishAlertDue(told)).toBeNull();
    const fixed = afterSuccess(told, '2026-10-07T04:30:00Z');
    expect(publishAlertDue(fixed)).toBe('recovered');
    expect(publishAlertDue({ ...fixed, failureAlertedAt: null })).toBeNull();
    expect(publishAlertDue(afterSuccess(undefined, '2026-10-07T04:30:00Z'))).toBeNull();
  });

  it('escapes the error in the Telegram message', () => {
    const msg = buildPublishFailedMessage(afterFailure({}, '2026-10-07T04:15:00Z', 'bad <path>'));
    expect(msg).toContain('bad &lt;path&gt;');
    expect(msg).toContain('Nothing has been published yet.');
  });
});
