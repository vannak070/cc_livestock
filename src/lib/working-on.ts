/**
 * "Working on": an office account can look at one farm at a time instead of
 * every farm. It is a view choice, not a permission: the server still allows
 * everything the person is allowed to do, and the choice is remembered in this
 * browser only.
 */

const KEY = (userId: string) => `cc_working_on:${userId}`;

/** The farm chosen last time on this browser, or '' for all farms. */
export function readFocus(userId: string): string {
  try {
    return window.localStorage.getItem(KEY(userId)) ?? '';
  } catch {
    return '';
  }
}

export function saveFocus(userId: string, farm: string): void {
  try {
    if (farm) window.localStorage.setItem(KEY(userId), farm);
    else window.localStorage.removeItem(KEY(userId));
  } catch {
    /* remembering is a convenience; the choice still works for this visit */
  }
}

/** The chosen farm when it still exists, otherwise all farms (a renamed or deleted farm is forgotten). */
export function validFocus(choice: string, farmNames: string[]): string {
  return choice && farmNames.includes(choice) ? choice : '';
}
