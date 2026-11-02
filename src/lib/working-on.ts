/**
 * "Working on": an office account can look at one farm at a time instead of
 * every farm. It is a view choice, not a permission: the server still allows
 * everything the person is allowed to do, and the choice is remembered in this
 * browser only.
 */

/** The browser-storage key for one person's choice ('' or missing = all farms); read with useStoredValue. */
export const focusKey = (userId: string) => `cc_working_on:${userId}`;

/** The chosen farm when it still exists, otherwise all farms (a renamed or deleted farm is forgotten). */
export function validFocus(choice: string, farmNames: string[]): string {
  return choice && farmNames.includes(choice) ? choice : '';
}
