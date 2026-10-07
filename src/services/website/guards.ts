import { Actor, AuthzError } from '../../lib/authz';
import { canHandleWebsiteRequests, canPublishWebsite } from '../../lib/website';

/** Publishing anything, consent, news, photos: Super Admin and Admin only. */
export function assertWebsiteAdmin(actor: Actor): void {
  if (!canPublishWebsite(actor)) throw new AuthzError('Only a Super Admin or Admin can manage the website.', 403);
}

/** Applications and inquiries: anyone with `website_requests`. */
export function assertRequestHandler(actor: Actor): void {
  if (!canHandleWebsiteRequests(actor)) throw new AuthzError('You do not have permission to see website requests.', 403);
}
