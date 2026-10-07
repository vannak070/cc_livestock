import { hasPermission } from '../utils';

/**
 * Who may do what with the public website (docs/website/README.md):
 * - publishing farms, cattle and news, recording consent: Super Admin and Admin only;
 * - seeing and answering applications and price inquiries: anyone with `website_requests`
 *   (Super Admin and Admin always have it).
 */
export const WEBSITE_ADMIN_ROLES: readonly string[] = ['Super Admin', 'Admin'];

type User = { role?: string; permissions?: readonly string[] } | null | undefined;

export const canPublishWebsite = (user: User): boolean => !!user && WEBSITE_ADMIN_ROLES.includes(user.role ?? '');

export const canHandleWebsiteRequests = (user: User): boolean => hasPermission(user, 'website_requests');

/** The Website page shows for anyone who can do either. */
export const canOpenWebsitePage = (user: User): boolean => canPublishWebsite(user) || canHandleWebsiteRequests(user);
