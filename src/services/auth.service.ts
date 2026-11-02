import { settingsRepository } from '../repositories/settings.repository';
import { verifyPassword } from '../lib/password';
import { sessionService } from './session.service';
import { UserRoleItem } from '../lib/types';

export interface AppError extends Error {
  statusCode?: number;
}

function makeError(message: string, statusCode: number): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}

// A real bcrypt hash (cost 10, like the accounts') of a random password nobody knows. login() checks
// against it when no account has the email, so unknown emails cost as much time as real ones.
const NO_ACCOUNT_HASH = '$2b$10$XNpP1lf1r2W6RZ68BIyW2.RPbuQhiO2z3FZoPGBCr.0ZGewJi.Gce';

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

    // Wrong passwords are counted per email, whether or not an account has it, so the lockout (and its message)
    // tells a guesser nothing about who has an account. A right password clears the count.
    const attemptKey = `pw:${email.trim().toLowerCase()}`;
    const { locked, retryAfterMin } = lockoutState(attemptKey);
    if (locked) {
      throw makeError(`Too many wrong passwords. Try again in ${retryAfterMin} minute(s).`, 429);
    }

    const user = await settingsRepository.getUserWithPasswordHashByEmail(email.trim());
    // Always check a password, against a stand-in hash when the email is unknown, so the reply
    // takes as long either way; and say "inactive" only to someone who knew the password. Otherwise
    // anyone could find out which emails have accounts, and which of them are switched off.
    const valid = await verifyPassword(password, user?.password ?? NO_ACCOUNT_HASH);
    if (!user || !valid) {
      recordPinFailure(attemptKey);
      throw makeError('Invalid email or password.', 401);
    }
    pinAttempts.delete(attemptKey);
    if (user.status !== 'Active') {
      throw makeError('This account is inactive. Contact your administrator.', 403);
    }

    const { token } = await sessionService.issue(user);

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
    const { token } = await sessionService.issue(matched);
    return { token, user: matched };
  }

  async getCurrentUser(userId: string): Promise<UserRoleItem | null> {
    const settings = await settingsRepository.getSettings();
    return settings.users.find(u => u.id === userId) || null;
  }
}

export const authService = new AuthService();
