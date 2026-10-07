import { Router, Request, Response } from 'express';
import { requireWebsiteKey } from '../middleware/website-gateway.middleware';
import { slidingLimit } from '../lib/website/gateway-auth';
import { websiteIntakeService } from '../services/website/intake.service';
import { readSnapshot, readSnapshotPhoto } from '../services/website/gateway.service';

/**
 * The link between CC Livestock and the public website (mounted at
 * /api/v1/site). Only the website's server, holding WEBSITE_API_KEY, may call
 * it. The website reads the published snapshot and its photos from here and
 * sends its form entries and visit counts here, so it never needs a database
 * account or a shared folder. See docs/website/api-link.md.
 */
const router = Router();
router.use(requireWebsiteKey);

// Caps for the whole site together, in case the key were ever misused.
const applicationsLimit = slidingLimit(100, 60 * 60_000);
const inquiriesLimit = slidingLimit(200, 60 * 60_000);
const eventsLimit = slidingLimit(1_000, 60_000);

const MAX_APPLICATION_BYTES = 4_500_000;
const asBody = (req: Request): Record<string, unknown> | null =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : null;

router.get('/ping', async (_req: Request, res: Response) => {
  const snapshot = await readSnapshot();
  res.json({ ok: true, published: snapshot.published });
});

// The published snapshot. ETag lets the website ask "has it changed?" cheaply.
router.get('/snapshot', async (req: Request, res: Response) => {
  const snapshot = await readSnapshot();
  res.setHeader('ETag', snapshot.etag);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.headers['if-none-match'] === snapshot.etag) {
    res.status(304).end();
    return;
  }
  res.type('application/json').send(snapshot.body);
});

router.get('/photos/:key', async (req: Request, res: Response) => {
  const photo = await readSnapshotPhoto(String(req.params.key));
  if (!photo) {
    res.status(404).json({ ok: false, error: 'not-found' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type(photo.type).send(photo.data);
});

router.post('/applications', async (req: Request, res: Response, next) => {
  try {
    if (Number(req.headers['content-length'] ?? '0') > MAX_APPLICATION_BYTES) { res.status(413).json({ ok: false, error: 'too-large' }); return; }
    const body = asBody(req);
    if (!body) { res.status(400).json({ ok: false, error: 'bad-request' }); return; }
    if (applicationsLimit()) { res.status(429).json({ ok: false, error: 'too-many' }); return; }
    const result = await websiteIntakeService.application(body);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/inquiries', async (req: Request, res: Response, next) => {
  try {
    const body = asBody(req);
    if (!body) { res.status(400).json({ ok: false, error: 'bad-request' }); return; }
    if (inquiriesLimit()) { res.status(429).json({ ok: false, error: 'too-many' }); return; }
    const result = await websiteIntakeService.inquiry(body);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    next(err);
  }
});

// A visit count: always 204, and it never says why something was not counted.
router.post('/events', async (req: Request, res: Response) => {
  try {
    const body = asBody(req);
    if (body && !eventsLimit()) await websiteIntakeService.event(body);
  } catch (err) {
    console.error('[website] Visit not saved:', err instanceof Error ? err.message : err);
  }
  res.status(204).end();
});

export default router;
