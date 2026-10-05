import { settingsRepository } from '../repositories/settings.repository';
import { verifyPassword } from '../lib/password';
import { signAuthToken } from '../lib/jwt';
import { UserRoleItem } from '../lib/types';

export interface AppError extends Error {
  statusCode?: number;
}

function makeError(message: string, statusCode: number): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}

// A PIN is short, so the only thing standing between it and a guessing
// script is a lockout. Attempts are counted per client and the door closes
// for a while once too many fail. In-memory is deliberate: this API runs as
// a single process, and a counter that resets on restart is far better than
// no counter at all.
const PIN_MIN_LENGTH = 6;
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord { fails: number; lockedUntil: number }
const pinAttempts = new Map<string, AttemptRecord>();

function lockoutState(clientKey: string): { locked: boolean; retryAfterMin: number } {
  const rec = pinAttempts.get(clientKey);
  if (!rec) return { locked: false, retryAfterMin: 0 };
  if (rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterMin: Math.ceil((rec.lockedUntil - Date.now()) / 60000) };
  }
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) pinAttempts.delete(clientKey);
  return { locked: false, retryAfterMin: 0 };
}

function recordPinFailure(clientKey: string): void {
  const rec = pinAttempts.get(clientKey) || { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= MAX_PIN_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.fails = 0;
  }
  pinAttempts.set(clientKey, rec);
}

export class AuthService {
  async login(email: string, password: string): Promise<{ token: string; user: UserRoleItem }> {
    if (!email || !password) {
      throw makeError('Email and password are required.', 400);
    }

    const user = await settingsRepository.getUserWithPasswordHashByEmail(email.trim());
    if (!user) {
      throw makeError('Invalid email or password.', 401);
    }
    if (user.status !== 'Active') {
      throw makeError('This account is inactive. Contact your administrator.', 403);
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw makeError('Invalid email or password.', 401);
    }

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      farmLocation: user.farmLocation
    });

    const { password: _discard, ...safeUser } = user;
    return { token, user: safeUser as UserRoleItem };
  }

  /**
   * Signs in with a PIN alone. The PIN both identifies and authenticates, so
   * every PIN-enabled account is checked; only accounts an administrator has
   * explicitly given a PIN can sign in this way.
   */
  async loginWithPin(pin: string, clientKey: string): Promise<{ token: string; user: UserRoleItem }> {
    const { locked, retryAfterMin } = lockoutState(clientKey);
    if (locked) {
      throw makeError(`Too many incorrect PINs. Try again in ${retryAfterMin} minute(s).`, 429);
    }

    const clean = (pin || '').trim();
    if (!/^\d+$/.test(clean) || clean.length < PIN_MIN_LENGTH) {
      throw makeError(`Enter your ${PIN_MIN_LENGTH}-digit PIN.`, 400);
    }

    const candidates = await settingsRepository.getPinEnabledUsers();
    let matched: UserRoleItem | null = null;
    for (const u of candidates) {
      // Every candidate is checked even after a match, so the time taken
      // does not reveal which account (or how many) a PIN belongs to.
      if (await verifyPassword(clean, u.pinHash) && !matched) {
        const { pinHash: _discard, ...safe } = u;
        matched = safe as UserRoleItem;
      }
    }

    if (!matched) {
      recordPinFailure(clientKey);
      throw makeError('Incorrect PIN.', 401);
    }

    pinAttempts.delete(clientKey);
    const token = signAuthToken({
      sub: matched.id,
      email: matched.email,
      role: matched.role,
      farmLocation: matched.farmLocation
    });
    return { token, user: matched };
  }

  async getCurrentUser(userId: string): Promise<UserRoleItem | null> {
    const settings = await settingsRepository.getSettings();
    return settings.users.find(u => u.id === userId) || null;
  }
}

export const authService = new AuthService();
