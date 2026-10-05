import { describe, expect, it } from 'vitest';
import { validatePinStrength, MIN_PIN_LENGTH } from './pin';
import { hashPassword, isBcryptHash, verifyPassword } from './password';
import { signAuthToken, verifyAuthToken } from './jwt';

describe('PIN policy', () => {
  it('accepts a non-predictable numeric PIN', () => {
    expect(validatePinStrength('284915')).toBeNull();
  });

  it.each(['12ab56', '12 456'])('rejects non-digits (%s)', pin => {
    expect(validatePinStrength(pin)).toMatch(/digits only/);
  });

  it('rejects short PINs', () => {
    expect(validatePinStrength('1'.repeat(MIN_PIN_LENGTH - 1) + '')).toMatch(/at least/);
  });

  it.each(['111111', '123456', '654321', '121212'])('rejects predictable PIN %s', pin => {
    expect(validatePinStrength(pin)).toMatch(/too easy to guess/);
  });
});

describe('passwords', () => {
  it('hashes with bcrypt and verifies only the right password', async () => {
    const hash = await hashPassword('correct horse');
    expect(isBcryptHash(hash)).toBe(true);
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('never verifies against a missing or plaintext hash', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'x')).toBe(false);
    expect(isBcryptHash('plaintext')).toBe(false);
  });
});

describe('auth tokens', () => {
  it('round-trips the payload', () => {
    const token = signAuthToken({ sub: 'u1', email: 'a@x.test', role: 'Admin', farmLocation: 'Farm A' });
    expect(verifyAuthToken(token)).toMatchObject({ sub: 'u1', role: 'Admin', farmLocation: 'Farm A' });
  });

  it('rejects tampered tokens', () => {
    const token = signAuthToken({ sub: 'u1', email: 'a@x.test', role: 'Admin' });
    expect(() => verifyAuthToken(token.slice(0, -2) + 'xx')).toThrow();
  });
});
