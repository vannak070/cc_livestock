import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken, AuthTokenPayload } from '../lib/jwt';
import { Actor, loadActor, can } from '../lib/authz';
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
// expires.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ success: false, message: 'Missing or invalid Authorization header.', data: null });
    return;
  }

  let payload: AuthTokenPayload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.', data: null });
    return;
  }

  loadActor(payload.sub)
    .then(actor => {
      if (!actor) {
        res.status(401).json({ success: false, message: 'This account no longer exists or is inactive.', data: null });
        return;
      }
      req.authUser = payload;
      req.actor = actor;
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
