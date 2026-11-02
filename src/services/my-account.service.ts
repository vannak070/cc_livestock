import type { Actor } from '../lib/authz';
import { PROBLEM_TEXT, nameProblem, newPasswordProblem } from '../lib/my-account';
import { verifyPassword } from '../lib/password';
import { settingsRepository } from '../repositories/settings.repository';

/** Wrong "current password" tries allowed per account in WINDOW_MS, so an unlocked screen cannot be used to guess it. */
const MAX_WRONG = 5;
const WINDOW_MS = 15 * 60 * 1000;
const wrong = new Map<string, { count: number; first: number }>();

function assertNotLocked(id: string, now: number): void {
  const w = wrong.get(id);
  if (w && now - w.first < WINDOW_MS && w.count >= MAX_WRONG) {
    const minutes = Math.ceil((WINDOW_MS - (now - w.first)) / 60000);
    throw new Error(`Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }
}

function recordWrong(id: string, now: number): void {
  const w = wrong.get(id);
  wrong.set(id, w && now - w.first < WINDOW_MS ? { count: w.count + 1, first: w.first } : { count: 1, first: now });
}

/**
 * "My account" (side menu -> your name): any signed-in person changes their own name or password. Nothing here can
 * change anyone else, or one's own email, role or farm (those stay with admins in Settings -> People).
 */
export class MyAccountService {
  async rename(actor: Actor, name: string): Promise<{ name: string }> {
    const problem = nameProblem(name);
    if (problem) throw new Error(PROBLEM_TEXT[problem]);
    await settingsRepository.setUserName(actor.id, name.trim());
    return { name: name.trim() };
  }

  async changePassword(actor: Actor, input: { current: string; next: string; repeat: string }, now = Date.now()): Promise<void> {
    assertNotLocked(actor.id, now);
    const problem = newPasswordProblem({ ...input, email: actor.email });
    if (problem) throw new Error(PROBLEM_TEXT[problem]);
    const account = await settingsRepository.getUserWithPasswordHashByEmail(actor.email);
    if (!account || account.id !== actor.id) throw new Error('Your account could not be found. Sign in again.');
    if (!(await verifyPassword(input.current, account.password))) {
      recordWrong(actor.id, now);
      throw new Error(PROBLEM_TEXT.wrongCurrent);
    }
    wrong.delete(actor.id);
    await settingsRepository.setUserPassword(actor.id, input.next);
  }

  /** Tests only. */
  resetAttempts(): void { wrong.clear(); }
}

export const myAccountService = new MyAccountService();
