import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_ROLE_PERMISSIONS, PermissionKey } from "../types/settings.types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
