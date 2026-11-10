import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_ROLE_PERMISSIONS, FARM_ROLES, OFFICE_ONLY_PERMISSIONS, PermissionKey } from "../types/settings.types"
import { noteStaleApp, STALE_APP_MESSAGE } from "./app-update"

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
 * Who gets the Reports page, which now also holds what the Summary page used to show: anyone with the
 * analytics view, and anyone who could see the old Summary (the dashboard view plus the sales view).
 */
export function canOpenReports(user: { role?: string; permissions?: readonly string[] } | null | undefined): boolean {
  return hasPermission(user, 'analytics_view') || (hasPermission(user, 'dashboard_view') && hasPermission(user, 'sales_view'));
}

export function hasPermission(
  currentUser: { role?: string; permissions?: readonly string[] } | null | undefined,
  key: PermissionKey
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'Super Admin' || currentUser.role === 'Admin') return true;
  if (FARM_ROLES.includes(currentUser.role ?? '') && OFFICE_ONLY_PERMISSIONS.includes(key)) return false;

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

/**
 * The message of a caught value, or `fallback` when it has none (catch clauses are `unknown`). A failure because the
 * page is from an older release of CC Livestock gets a plain "reload" message and shows the update banner.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (noteStaleApp(err)) return STALE_APP_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}
