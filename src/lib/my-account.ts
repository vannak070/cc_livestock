import { MIN_PASSWORD_LENGTH } from './user-admin';

/**
 * "My account": every signed-in person may change their own name and password (user request 2026-10-28, after the
 * production Super Admin found no way to change theirs). Email, role and farm stay with the admins (Settings -> People).
 * Pure rules shared by the dialog and the server (src/services/my-account.service.ts). They return a CODE: the dialog
 * shows it in the chosen language (myAccount.p_<code>), the server turns it into the English message below.
 */

export const MAX_NAME_LENGTH = 100;

export type AccountProblem =
  | 'nameEmpty' | 'nameLong'
  | 'currentEmpty' | 'tooShort' | 'notSame' | 'sameAsCurrent' | 'isEmail'
  | 'wrongCurrent' | 'locked';

/** The server's English wording for each problem (REST callers and logs; the dialog uses its own translations). */
export const PROBLEM_TEXT: Record<AccountProblem, string> = {
  nameEmpty: 'Enter your name.',
  nameLong: `A name can have at most ${MAX_NAME_LENGTH} characters.`,
  currentEmpty: 'Enter your current password.',
  tooShort: `The new password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
  notSame: 'The two new passwords are not the same.',
  sameAsCurrent: 'The new password must be different from the current one.',
  isEmail: 'Do not use your email as your password.',
  wrongCurrent: 'Your current password is not correct.',
  locked: 'Too many wrong passwords. Try again later.',
};

/** Which problem a server message is, so the dialog can show it in the chosen language; null if it is another error. */
export function problemOfMessage(message: string): AccountProblem | null {
  if (message.startsWith('Too many wrong passwords')) return 'locked';
  const hit = (Object.entries(PROBLEM_TEXT) as [AccountProblem, string][]).find(([, text]) => text === message);
  return hit ? hit[0] : null;
}

/** Why this name cannot be saved, or null. */
export function nameProblem(name: string): AccountProblem | null {
  const n = name.trim();
  if (!n) return 'nameEmpty';
  if (n.length > MAX_NAME_LENGTH) return 'nameLong';
  return null;
}

/** Why this new password cannot be used, or null. The current password is checked against the account on the server. */
export function newPasswordProblem(input: { current: string; next: string; repeat: string; email: string }): AccountProblem | null {
  if (!input.current) return 'currentEmpty';
  if (input.next.length < MIN_PASSWORD_LENGTH) return 'tooShort';
  if (input.next !== input.repeat) return 'notSame';
  if (input.next === input.current) return 'sameAsCurrent';
  if (input.next.trim().toLowerCase() === input.email.trim().toLowerCase()) return 'isEmail';
  return null;
}
