# The API link between CC Livestock and the public website

The public website (the `website/` app, port 3200) and CC Livestock (the office app and its API
server) are **linked by an API**, not by a shared folder or a shared database login.

```
Public website (visitors)                         CC Livestock (office)
  pages + /public/v1  ── reads  GET /snapshot ──►  website gateway  ─► .website-snapshot/ (published by the office)
  Join / price forms  ── sends  POST /applications ─►  (checks everything again) ─► website_* tables ─► Requests tab + Telegram
  visit counts        ── sends  POST /events ─────►
                      shared secret in every call (Authorization: Bearer <key>)
```

The gateway lives in the CC Livestock **API server** (`npm run server`, port 3002, PM2 app
`cc-livestock-api`), under `/api/v1/site`. It is separate from the office API: the office API needs a
user's sign-in; the gateway needs the shared key and can do nothing except the calls below.

## The calls

| Call | What it does |
| --- | --- |
| `GET /ping` | `{ ok: true, published: true/false }`. Use it to check the link and the key. |
| `GET /snapshot` | The published public snapshot (JSON). Answers `304` when the website's `If-None-Match` ETag is still current. An empty snapshot before anything is published. |
| `GET /photos/<id>-small` or `-large` | A photo the snapshot shows. Only that name shape is accepted. |
| `POST /applications` | A Join form (with up to 3 photos). Checked again here; saved with its photos in one transaction. |
| `POST /inquiries` | A price inquiry or "tell me when cattle are available". |
| `POST /events` | A visit count. Always `204`; it never says why something was not counted. |

Errors: `401` wrong or missing key (never says which), `503` the gateway is off (no key set), `400` with
`{ ok: false, field }` for a wrong form field, `413` too large, `429` too many.

## The key

One secret, two names:

| Where | Setting |
| --- | --- |
| CC Livestock (`.env`) | `WEBSITE_API_KEY` (32+ characters; without it the gateway is switched off) |
| Website (`website/.env.local`) | `CAMCOW_API_KEY` (the same value) and `CAMCOW_API_URL` (for example `http://localhost:3002/api/v1/site`) |

Make one: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
To **change the key**: put the new value in both places and restart the API server and the website.
The key is checked in constant time, never logged and never put in an error. Do not commit it.

## What is protected

- The website sees only the published, rounded, allow-listed snapshot (see README: "Rules that protect
  confidential data"). The gateway adds nothing to that.
- Everything the website sends is **validated again** in CC Livestock (`src/lib/website/intake.ts`,
  `src/services/website/intake-photos.ts`): the website is on the open internet. A test
  (`intake.test.ts`, `intake-photos.test.ts`) fails if these rules and the website's own
  (`website/src/lib/forms`) ever differ.
- Caps for the whole site together: 100 applications an hour, 200 inquiries an hour, 1,000 visit counts a
  minute. Wrong keys are slowed down after 30 a minute from one address (a correct key is never slowed).
- The website needs **no database account and no shared folder** in this mode. Remove
  `FORMS_DATABASE_URL` from its settings when you are sure you do not want the old way back.

## When CC Livestock is not reachable

- The website keeps showing the **last good snapshot** and does not retry for 10 seconds after a failure
  (it never waits on a dead server for every page). With no copy yet it shows its empty states.
- A form entry fails and the visitor sees "try again"; nothing is half-saved.
- Photos already shown stay cached for 5 minutes.

## Two ways to run the website

| | Set | Behaviour |
| --- | --- | --- |
| **API** (now) | `CAMCOW_API_URL` and `CAMCOW_API_KEY` | Everything goes through the gateway. Needs the API server running. |
| **Folder + database** (the old way) | leave `CAMCOW_API_URL` out | Reads `../.website-snapshot` (or `CAMCOW_SNAPSHOT_DIR`) and writes with `FORMS_DATABASE_URL` (`npm run website:forms-user`). Only works on the same computer. |

For local work, `npm run dev:all` starts the API server, the office app and the website together.
The API server must be running for the API mode, and it also publishes the snapshot every 15
minutes and sends the Telegram message for each new request.

## Putting it on a server

- **Same server:** `CAMCOW_API_URL=http://127.0.0.1:3002/api/v1/site`. Nothing else needs to be
  reachable from the internet.
- **Different servers:** put the API behind HTTPS and expose **only** `/api/v1/site/` to the website's
  address (for example an nginx `location /api/v1/site/` with `allow <website ip>; deny all;`). The
  rest of the office API should stay private. Use `https://...` in `CAMCOW_API_URL`.
- Run the API server under PM2 (`cc-livestock-api`): without it there is no snapshot refresh, no request
  Telegram and no form intake.
- Check the link from the website's server: `curl -H "Authorization: Bearer $CAMCOW_API_KEY" "$CAMCOW_API_URL/ping"`.

## Where the code is

| Part | Files |
| --- | --- |
| Routes and key check | `src/routes/website-gateway.routes.ts`, `src/middleware/website-gateway.middleware.ts`, `src/lib/website/gateway-auth.ts` |
| Rules for what the website may send | `src/lib/website/intake.ts`, `src/services/website/intake-photos.ts` |
| Saving and reading | `src/services/website/intake.service.ts`, `src/repositories/website/intake.repository.ts`, `src/services/website/gateway.service.ts` |
| The website's side | `website/src/lib/gateway.ts`, `website/src/lib/snapshot/read.ts`, `website/src/lib/forms/db.ts` |
| Tests | `src/routes/website-gateway.routes.test.ts`, `src/lib/website/intake.test.ts`, `gateway-auth.test.ts`, `src/services/website/intake-photos.test.ts`, `website/src/lib/gateway.test.ts` |
