import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ getUserWithPasswordHashByEmail: vi.fn(), setUserPassword: vi.fn(), setUserName: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));

import { MyAccountService } from './my-account.service';
import { hashPassword } from '../lib/password';
import { nameProblem, newPasswordProblem, problemOfMessage } from '../lib/my-account';
import type { Actor } from '../lib/authz';

const service = new MyAccountService();
const me = { id: 'U1', name: 'Dara', email: 'dara@x.test', role: 'Farm Staff', status: 'Active', farmLocation: 'SNR Farm' } as unknown as Actor;
const change = (over: Partial<{ current: string; next: string; repeat: string }> = {}) => ({ current: 'old-pass-1', next: 'new-pass-22', repeat: 'new-pass-22', ...over });

beforeEach(async () => {
  Object.values(settings).forEach(f => f.mockReset());
  service.resetAttempts();
  settings.getUserWithPasswordHashByEmail.mockResolvedValue({ ...me, password: await hashPassword('old-pass-1') });
});

describe('my account: the rules', () => {
  it('needs a name, not too long', () => {
    expect(nameProblem('  ')).toBe('nameEmpty');
    expect(nameProblem('x'.repeat(101))).toBe('nameLong');
    expect(nameProblem(' Dara ')).toBeNull();
  });
  it('checks the new password before anything is looked up', () => {
    const base = { current: 'a', next: 'longenough', repeat: 'longenough', email: 'dara@x.test' };
    expect(newPasswordProblem({ ...base, current: '' })).toBe('currentEmpty');
    expect(newPasswordProblem({ ...base, next: 'short', repeat: 'short' })).toBe('tooShort');
    expect(newPasswordProblem({ ...base, repeat: 'different!' })).toBe('notSame');
    expect(newPasswordProblem({ ...base, current: 'longenough' })).toBe('sameAsCurrent');
    expect(newPasswordProblem({ ...base, next: 'DARA@x.test', repeat: 'DARA@x.test' })).toBe('isEmail');
    expect(newPasswordProblem(base)).toBeNull();
  });
  it('knows the server messages again, so the dialog can translate them', () => {
    expect(problemOfMessage('Your current password is not correct.')).toBe('wrongCurrent');
    expect(problemOfMessage('Too many wrong passwords. Try again in 7 minutes.')).toBe('locked');
    expect(problemOfMessage('Something else broke')).toBeNull();
  });
});

describe('MyAccountService', () => {
  it('changes only my own password, after checking the current one', async () => {
    await service.changePassword(me, change());
    expect(settings.getUserWithPasswordHashByEmail).toHaveBeenCalledWith('dara@x.test');
    expect(settings.setUserPassword).toHaveBeenCalledWith('U1', 'new-pass-22');
  });

  it('refuses a wrong current password and saves nothing', async () => {
    await expect(service.changePassword(me, change({ current: 'wrong-pass' }))).rejects.toThrow(/current password is not correct/);
    expect(settings.setUserPassword).not.toHaveBeenCalled();
  });

  it('makes the person wait after 5 wrong current passwords, even if the 6th is right', async () => {
    const t = Date.UTC(2026, 9, 28, 5, 0);
    for (let i = 0; i < 5; i++) await expect(service.changePassword(me, change({ current: 'wrong-pass' }), t)).rejects.toThrow(/not correct/);
    await expect(service.changePassword(me, change(), t + 1000)).rejects.toThrow(/Too many wrong passwords. Try again in 15 minutes/);
    expect(settings.setUserPassword).not.toHaveBeenCalled();
    await service.changePassword(me, change(), t + 16 * 60 * 1000); // the window has passed
    expect(settings.setUserPassword).toHaveBeenCalledTimes(1);
  });

  it('never touches another account that happens to share the lookup', async () => {
    settings.getUserWithPasswordHashByEmail.mockResolvedValue({ ...me, id: 'SOMEONE-ELSE', password: await hashPassword('old-pass-1') });
    await expect(service.changePassword(me, change())).rejects.toThrow(/could not be found/);
    expect(settings.setUserPassword).not.toHaveBeenCalled();
  });

  it('renames only me, trimmed', async () => {
    await expect(service.rename(me, '   ')).rejects.toThrow(/Enter your name/);
    expect(await service.rename(me, '  Dara Sok ')).toEqual({ name: 'Dara Sok' });
    expect(settings.setUserName).toHaveBeenCalledWith('U1', 'Dara Sok');
  });
});
