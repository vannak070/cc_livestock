import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock('./session', () => ({ requireSessionActor: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: { getActiveUserById: vi.fn() } }));

import { runAction } from './run-action';
import { requireSessionActor } from './session';
import { AuthzError } from './authz';

const actor = { id: 'u1' } as never;

describe('runAction', () => {
  beforeEach(() => {
    revalidatePath.mockClear();
    vi.mocked(requireSessionActor).mockReset().mockResolvedValue(actor);
  });

  it('returns the data, revalidates, and checks the requested permissions', async () => {
    const res = await runAction('fallback', ['stock_edit'], async () => 42);
    expect(res).toEqual({ success: true, data: 42 });
    expect(requireSessionActor).toHaveBeenCalledWith('stock_edit');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('passes the actor to the body', async () => {
    const body = vi.fn().mockResolvedValue('ok');
    await runAction('fallback', [], body);
    expect(body).toHaveBeenCalledWith(actor);
  });

  it('skips revalidation when asked (read-only actions)', async () => {
    await runAction('fallback', [], async () => 1, { revalidate: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('turns an authorization failure into an error result with its status and never runs the body', async () => {
    vi.mocked(requireSessionActor).mockRejectedValue(new AuthzError('nope', 403));
    const body = vi.fn();
    const res = await runAction('fallback', ['stock_delete'], body);
    expect(res).toEqual({ success: false, error: 'nope', status: 403 });
    expect(body).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('uses the error message, or the fallback when there is none', async () => {
    expect(await runAction('fallback', [], async () => { throw new Error('db down'); }))
      .toEqual({ success: false, error: 'db down' });
    expect(await runAction('fallback', [], async () => { throw 'weird'; }))
      .toEqual({ success: false, error: 'fallback' });
  });
});
