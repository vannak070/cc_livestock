import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ getSessionSettings: vi.fn(), patchBlob: vi.fn(), getActiveUserById: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));

import { SessionService } from './session.service';
import { verifyAuthToken, signAuthToken } from '../lib/jwt';
import { AuthzError } from '../lib/authz';
import { MAX_SESSION_HOURS, idleMinutes, sessionExpiry, sessionPolicyProblem } from '../lib/session-policy';
import type { UserRoleItem } from '../lib/types';

const user = (role = 'Admin') => ({ id: 'u1', name: 'P', email: 'p@x.test', role, status: 'Active' }) as UserRoleItem;
const now = () => Math.floor(Date.now() / 1000);

describe('session policy', () => {
  it('uses 60 minutes unless a listed choice is saved', () => {
    expect(idleMinutes(undefined)).toBe(60);
    expect(idleMinutes({ idleMinutes: 30 })).toBe(30);
    expect(idleMinutes({ idleMinutes: 7 })).toBe(60);
    expect(sessionPolicyProblem({ idleMinutes: 7 })).toMatch(/Choose one/);
    expect(sessionPolicyProblem({ idleMinutes: 120 })).toBeNull();
  });

  it('never runs past the longest session', () => {
    expect(sessionExpiry(1000, 1000, 60)).toBe(1000 + 3600);
    expect(sessionExpiry(0, MAX_SESSION_HOURS * 3600 - 600, 60)).toBe(MAX_SESSION_HOURS * 3600);
  });
});

describe('SessionService', () => {
  let service: SessionService;
  beforeEach(() => {
    service = new SessionService();
    settings.getSessionSettings.mockReset().mockResolvedValue(undefined);
    settings.patchBlob.mockReset().mockResolvedValue(undefined);
    settings.getActiveUserById.mockReset().mockImplementation(async () => user());
  });

  it('issues a sign-in that runs out after the idle time', async () => {
    settings.getSessionSettings.mockResolvedValue({ idleMinutes: 30 });
    const issued = await service.issue(user());
    const payload = verifyAuthToken(issued.token);
    expect(issued.idleMinutes).toBe(30);
    expect(payload.exp).toBe(issued.expiresAt);
    expect(issued.expiresAt - now()).toBeGreaterThanOrEqual(30 * 60 - 1);
    expect(issued.expiresAt - now()).toBeLessThanOrEqual(30 * 60);
  });

  it('keeps the original sign-in time when renewing', async () => {
    const at = now() - 3000;
    const issued = await service.issue(user(), at);
    expect(verifyAuthToken(issued.token).signedInAt).toBe(at);
    const checked = await service.check(issued.token);
    expect(checked?.actor.id).toBe('u1');
    // Compared with the account's last password change.
    expect(settings.getActiveUserById).toHaveBeenCalledWith('u1', at);
  });

  it('cannot be renewed past 12 hours', async () => {
    const issued = await service.issue(user(), now() - MAX_SESSION_HOURS * 3600 + 600);
    expect(issued.atLongest).toBe(true);
    expect(issued.expiresAt - now()).toBeLessThanOrEqual(600);
  });

  it('refuses expired tokens, tokens over 12 hours old, and old tokens without a sign-in time', async () => {
    const expired = signAuthToken({ sub: 'u1', email: 'p@x.test', role: 'Admin', signedInAt: now() - 4000 }, now() - 5);
    const tooOld = signAuthToken({ sub: 'u1', email: 'p@x.test', role: 'Admin', signedInAt: now() - MAX_SESSION_HOURS * 3600 }, now() + 600);
    const jwt = await import('jsonwebtoken');
    const { resolveJwtSecret } = await import('../lib/server-security');
    const r = resolveJwtSecret(process.env);
    const legacy = jwt.default.sign({ sub: 'u1', email: 'p@x.test', role: 'Admin' }, 'secret' in r ? r.secret : '', { algorithm: 'HS256', expiresIn: '30d' });
    expect(await service.check(expired)).toBeNull();
    expect(await service.check(tooOld)).toBeNull();
    expect(await service.check(legacy)).toBeNull();
    expect(settings.getActiveUserById).not.toHaveBeenCalled();
  });

  it('refuses a sign-in made before the password was changed', async () => {
    settings.getActiveUserById.mockResolvedValue(null);
    const issued = await service.issue(user());
    expect(await service.check(issued.token)).toBeNull();
  });

  it('renews at most once a minute', () => {
    expect(service.dueForRenewal({ sub: 'u1', email: '', role: '', iat: now() - 10 })).toBe(false);
    expect(service.dueForRenewal({ sub: 'u1', email: '', role: '', iat: now() - 61 })).toBe(true);
  });

  it.each(['Admin', 'Company', 'Management', 'Farm Owner'])('only the Super Admin changes the time limit, not a %s', async role => {
    await expect(service.savePolicy(user(role), { idleMinutes: 30 })).rejects.toBeInstanceOf(AuthzError);
    expect(settings.patchBlob).not.toHaveBeenCalled();
  });

  it('saves a listed choice for the Super Admin and uses it straight away', async () => {
    await expect(service.savePolicy(user('Super Admin'), { idleMinutes: 7 })).rejects.toThrow(/Choose one/);
    expect(await service.idleMinutes()).toBe(60);
    settings.getSessionSettings.mockResolvedValue({ idleMinutes: 120 });
    await service.savePolicy(user('Super Admin'), { idleMinutes: 120 });
    expect(settings.patchBlob).toHaveBeenCalledWith({ session: { idleMinutes: 120 } });
    expect(await service.idleMinutes()).toBe(120);
  });
});
