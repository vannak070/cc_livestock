import { Request, Response, NextFunction } from 'express';
import { bearerToken, configuredKey, keyMatches, keyedLimit } from '../lib/website/gateway-auth';

/** Wrong keys per address per minute before further attempts are refused (slows down guessing). */
const tooManyFailures = keyedLimit(30, 60_000);
const failures = (ip: string) => tooManyFailures(ip);

/**
 * Only the public website's server may use the website gateway: it must send
 * "Authorization: Bearer <WEBSITE_API_KEY>". Without a key set on the server
 * the gateway is switched off. The answers never say which part was wrong.
 */
export function requireWebsiteKey(req: Request, res: Response, next: NextFunction): void {
  const key = configuredKey();
  if (!key) {
    res.status(503).json({ ok: false, error: 'not-enabled' });
    return;
  }
  if (keyMatches(bearerToken(req.headers.authorization), key)) {
    next();
    return;
  }
  const ip = req.ip || 'unknown';
  if (failures(ip)) {
    res.status(429).json({ ok: false, error: 'too-many' });
    return;
  }
  res.status(401).json({ ok: false, error: 'unauthorized' });
}
