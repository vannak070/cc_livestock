import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_ROLE_PERMISSIONS, PermissionKey } from "../types/settings.types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Planning (fattening plans) is for these roles only, whatever access a
 * person or a custom role has been given: farm accounts and other office
 * roles never see it. Checked on the server too (authz.ts).
 */
export const PLANNING_ROLES: readonly string[] = ['Super Admin', 'Admin', 'Management'];

export function canUsePlanning(user: { role?: string } | null | undefined): boolean {
  return !!user?.role && PLANNING_ROLES.includes(user.role);
}

/**
 * A Farm Owner may read their own farm's loan plan (Planning → Farm loans),
 * nothing else in Planning, and may not change it.
 */
export function canSeeOwnLoan(user: { role?: string; farmLocation?: string } | null | undefined): boolean {
  return user?.role === 'Farm Owner' && !!user.farmLocation;
}

export function hasPermission(
  currentUser: { role?: string; permissions?: readonly string[] } | null | undefined,
  key: PermissionKey
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'Super Admin' || currentUser.role === 'Admin') return true;

  if (currentUser.permissions && Array.isArray(currentUser.permissions)) {
    return currentUser.permissions.includes(key);
  }

  const defaultPerms = (currentUser.role ? DEFAULT_ROLE_PERMISSIONS[currentUser.role] : undefined) || [];
  return defaultPerms.includes(key);
}

export function format2Decimals(val: number | string | null | undefined): string {
  const n = Number(val);
  if (isNaN(n)) return '0.00';
  return n.toFixed(2);
}

export function format2DecimalsWithCommas(val: number | string | null | undefined): string {
  const n = Number(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The message of a caught value, or `fallback` when it has none (catch clauses are `unknown`). */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
