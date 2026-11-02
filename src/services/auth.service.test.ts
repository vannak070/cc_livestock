import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ getUserWithPasswordHashByEmail: vi.fn(), getPinEnabledUsers: vi.fn(), getSettings: vi.fn() }));
const password = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));
vi.mock('../lib/password', () => password);
vi.mock('../lib/jwt', () => ({ signAuthToken: vi.fn((p: { sub: string }) => `token-for-${p.sub}`) }));

import { AuthService } from './auth.service';

const service = new AuthService();
const account = (over: object = {}) => ({ id: 'U1', name: 'Dara', email: 'dara@x.test', role: 'Admin', status: 'Active', password: 'hash:secret', permissions: [], ...over });
// The fake password check: a hash "hash:<plain>" matches that plain text only.
const fakeVerify = async (plain: string, hash: string | null | undefined) => hash === `hash:${plain}`;

beforeEach(() => {
  Object.values(settings).forEach(f => f.mockReset());
  password.verifyPassword.mockReset().mockImplementation(fakeVerify);
});

describe('AuthService.login', () => {
  it('signs a person in and never returns the password hash', async () => {
    settings.getUserWithPasswordHashByEmail.mockResolvedValue(account());
    const { token, user } = await service.login(' dara@x.test ', 'secret');
    expect(token).toBe('token-for-U1');
    expect(user).not.toHaveProperty('password');
    expect(settings.getUserWithPasswordHashByEmail).toHaveBeenCalledWith('dara@x.test');
  });

  it.each([['', 'secret'], ['dara@x.test', '']])('needs both email and password (%j, %j)', async (email, pass) => {
    await expect(service.login(email, pass)).rejects.toMatchObject({ statusCode: 400 });
    expect(settings.getUserWithPasswordHashByEmail).not.toHaveBeenCalled();
  });

  it('gives the same answer for a wrong password and an unknown email, so nobody can find out who has an account', async () => {
    settings.getUserWithPasswordHashByEmail.mockResolvedValueOnce(account());
    const wrong = await service.login('dara@x.test', 'nope').catch(e => e);
    settings.getUserWithPasswordHashByEmail.mockResolvedValueOnce(null);
    const unknown = await service.login('nobody@x.test', 'nope').catch(e => e);
    expect([wrong.statusCode, wrong.message]).toEqual([401, 'Invalid email or password.']);
    expect([unknown.statusCode, unknown.message]).toEqual([401, 'Invalid email or password.']);
  });

  it('checks a password even when the email is unknown, so the reply takes as long as for a real account', async () => {
    settings.getUserWithPasswordHashByEmail.mockResolvedValue(null);
    await expect(service.login('nobody@x.test', 'whatever')).rejects.toMatchObject({ statusCode: 401 });
    expect(password.verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('never signs in an unknown email, even if the password matches the stand-in hash it is checked against', async () => {
    settings.getUserWithPasswordHashByEmail.mockResolvedValue(null);
    password.verifyPassword.mockResolvedValue(true);
    await expect(service.login('nobody@x.test', 'whatever')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('tells an inactive account it is inactive only after the right password, so a stranger learns nothing', async () => {
    settings.getUserWithPasswordHashByEmail.mockResolvedValue(account({ status: 'Inactive' }));
    await expect(service.login('dara@x.test', 'nope')).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password.' });
    await expect(service.login('dara@x.test', 'secret')).rejects.toMatchObject({ statusCode: 403, message: expect.stringMatching(/inactive/) });
  });
});

describe('AuthService.login lockout', () => {
  afterEach(() => vi.useRealTimers());
  let n = 0;
  const email = () => `guesser${++n}@x.test`;
  const withAccount = (e: string) => settings.getUserWithPasswordHashByEmail.mockImplementation(async (x: string) => (x.toLowerCase() === e ? account({ email: e }) : null));

  it('locks an email after 5 wrong passwords, even for the right password, and says how long to wait', async () => {
    const e = email();
    withAccount(e);
    for (let i = 0; i < 5; i++) await expect(service.login(e, 'wrong')).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.login(e, 'secret')).rejects.toMatchObject({ statusCode: 429, message: expect.stringMatching(/15 minute/) });
  });

  it('locks an email nobody has in the same way, so the lockout does not reveal who has an account', async () => {
    const e = email();
    settings.getUserWithPasswordHashByEmail.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) await expect(service.login(e, 'wrong')).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.login(e, 'wrong')).rejects.toMatchObject({ statusCode: 429 });
  });

  it('opens again after 15 minutes', async () => {
    vi.useFakeTimers();
    const e = email();
    withAccount(e);
    for (let i = 0; i < 5; i++) await service.login(e, 'wrong').catch(() => undefined);
    await expect(service.login(e, 'secret')).rejects.toMatchObject({ statusCode: 429 });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    await expect(service.login(e, 'secret')).resolves.toMatchObject({ token: 'token-for-U1' });
  });

  it('counts per email, and a right password clears the count', async () => {
    const a = email();
    const b = email();
    settings.getUserWithPasswordHashByEmail.mockImplementation(async (x: string) => account({ email: x }));
    for (let i = 0; i < 4; i++) await service.login(a, 'wrong').catch(() => undefined);
    await service.login(a, 'secret');
    for (let i = 0; i < 4; i++) await service.login(a, 'wrong').catch(() => undefined);
    await expect(service.login(a, 'secret')).resolves.toBeDefined();
    for (let i = 0; i < 5; i++) await service.login(b, 'wrong').catch(() => undefined);
    await expect(service.login(a, 'secret')).resolves.toBeDefined();
    await expect(service.login(b, 'secret')).rejects.toMatchObject({ statusCode: 429 });
  });
});

describe('AuthService.loginWithPin', () => {
  let n = 0;
  const client = () => `client-${++n}`; // the lockout is kept per client, so every test uses its own
  const withPins = () => settings.getPinEnabledUsers.mockResolvedValue([
    { ...account({ id: 'U1' }), pinHash: 'hash:123456' },
    { ...account({ id: 'U2', name: 'Sok' }), pinHash: 'hash:654321' },
  ]);

  afterEach(() => vi.useRealTimers());

  it('signs in the person who owns the PIN, without the PIN hash', async () => {
    withPins();
    const { token, user } = await service.loginWithPin('654321', client());
    expect(token).toBe('token-for-U2');
    expect(user).not.toHaveProperty('pinHash');
  });

  it('checks every PIN-enabled account even after a match, so the timing does not show which account it was', async () => {
    withPins();
    await service.loginWithPin('123456', client());
    expect(password.verifyPassword).toHaveBeenCalledTimes(2);
  });

  it.each(['12345', 'abcdef', '12 3456', ''])('refuses %j before looking at any account, and does not count it as a wrong guess', async pin => {
    const key = client();
    await expect(service.loginWithPin(pin, key)).rejects.toMatchObject({ statusCode: 400 });
    expect(settings.getPinEnabledUsers).not.toHaveBeenCalled();
    withPins();
    for (let i = 0; i < 6; i++) await service.loginWithPin(pin, key).catch(() => undefined); // many bad formats never lock the door
    await expect(service.loginWithPin('123456', key)).resolves.toMatchObject({ token: 'token-for-U1' });
  });

  it('locks the door after 5 wrong PINs, even for the right PIN, and says how long to wait', async () => {
    withPins();
    const key = client();
    for (let i = 0; i < 5; i++) await expect(service.loginWithPin('000000', key)).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.loginWithPin('123456', key)).rejects.toMatchObject({ statusCode: 429, message: expect.stringMatching(/15 minute/) });
  });

  it('opens the door again after 15 minutes', async () => {
    vi.useFakeTimers();
    withPins();
    const key = client();
    for (let i = 0; i < 5; i++) await service.loginWithPin('000000', key).catch(() => undefined);
    await expect(service.loginWithPin('123456', key)).rejects.toMatchObject({ statusCode: 429 });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    await expect(service.loginWithPin('123456', key)).resolves.toMatchObject({ token: 'token-for-U1' });
  });

  it('locks only the client that guessed, and a right PIN clears that client\'s count', async () => {
    withPins();
    const guesser = client();
    const other = client();
    for (let i = 0; i < 4; i++) await service.loginWithPin('000000', guesser).catch(() => undefined);
    await service.loginWithPin('123456', guesser); // the 5th try is right: the count restarts
    for (let i = 0; i < 4; i++) await service.loginWithPin('000000', guesser).catch(() => undefined);
    await expect(service.loginWithPin('123456', guesser)).resolves.toBeDefined();
    await expect(service.loginWithPin('123456', other)).resolves.toBeDefined();
  });
});
