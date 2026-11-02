import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { Actor } from './authz';
import { requireSessionActor } from './session';
import { PermissionKey } from './types';
import { LANG_COOKIE, localizeServerMessage } from './server-messages';

/** What every server action returns: the client checks `success`, then reads `data` or `error`. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

/**
 * Runs a server action body behind the standard guard: the caller must have a
 * live session and hold at least one of `permissions` (none = any signed-in
 * user). Failures become `{ success: false, error }` instead of throwing, with
 * the HTTP-style `status` (401/403) when the failure was an authorization one.
 * Successful writes revalidate the page unless `revalidate: false`.
 */
/** Common sign-in and access messages in the language the browser chose (server-messages.ts). */
async function inChosenLanguage(message: string): Promise<string> {
  try {
    return localizeServerMessage(message, (await cookies()).get(LANG_COOKIE)?.value);
  } catch {
    return message; // outside a request (tests, scripts)
  }
}

export async function runAction<T>(
  fallbackError: string,
  permissions: PermissionKey[],
  run: (actor: Actor) => Promise<T>,
  options: { revalidate?: boolean } = {}
): Promise<ActionResult<T>> {
  try {
    const actor = await requireSessionActor(...permissions);
    const data = await run(actor);
    if (options.revalidate !== false) revalidatePath('/');
    return { success: true, data };
  } catch (err) {
    const status = typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : undefined;
    return {
      success: false,
      error: await inChosenLanguage(err instanceof Error && err.message ? err.message : fallbackError),
      ...(status !== undefined ? { status } : {})
    };
  }
}
