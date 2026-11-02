import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload } from '../lib/jwt';
import { Actor, can } from '../lib/authz';
import { sessionService } from '../services/session.service';
import { PermissionKey } from '../lib/types';
import { canUsePlanning } from '../lib/utils';

export interface AuthedRequest extends Request {
  authUser?: AuthTokenPayload;
  actor?: Actor;
}

// Requires a valid "Authorization: Bearer <token>" header issued by
// POST /api/v1/auth/login (or /auth/pin). The token only says who the caller
// is; their account is re-read on every request, so deactivating a user or
// changing their role takes effect immediately rather than when the token
// expires. A token with no activity for the idle time has run out.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ success: false, message: 'Missing or invalid Authorization header.', data: null });
    return;
  }

  // The token runs out after the sign-in time limit (src/lib/session-policy.ts). Each request counts as activity:
  // a token more than a minute old is renewed and the new one sent back in the X-Session-Token header, which the
  // client should keep in place of the old one.
  sessionService.check(token)
    .then(async checked => {
      if (!checked) {
        res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.', data: null });
        return;
      }
      if (sessionService.dueForRenewal(checked.payload)) {
        const renewed = await sessionService.issue(checked.actor, checked.payload.signedInAt);
        res.setHeader('X-Session-Token', renewed.token);
      }
      req.authUser = checked.payload;
      req.actor = checked.actor;
      next();
    })
    .catch(next);
}

// Must run after requireAuth. Passes if the caller holds any one of `anyOf`.
export function requirePermission(...anyOf: PermissionKey[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (req.actor && anyOf.some(key => can(req.actor!, key))) {
      next();
      return;
    }
    res.status(403).json({ success: false, message: 'You do not have permission to perform this action.', data: null });
  };
}

// Must run after requireAuth. Planning is only for Super Admin, Admin and Management.
export function requirePlanningAccess(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.actor && canUsePlanning(req.actor)) {
    next();
    return;
  }
  res.status(403).json({ success: false, message: 'Planning is only for Super Admin, Admin and Management.', data: null });
}
