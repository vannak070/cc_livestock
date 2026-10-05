# CC Livestock — Agent Config

How an AI agent (or a human following the same rules) should work on this
repo. This is the real project — if you're reading this from a copy at
`StudioProjects/LiveStock`, that copy is stale/wrong; this repo
(`HOVA_Project/CC_Farm_Mgt`) is the source of truth.

## What this project is

Two apps sharing one backend, for a cattle fattening operation (CC Livestock):

1. **Web app** (this repo's root) — Next.js 16 (App Router, Turbopack) +
   PostgreSQL. The full operational ERP: stock intake, batch/cohort
   management, weight tracking, health logs, feed & inventory,
   sales/finance, analytics, settings/permissions. Operations staff log in
   here and do all data entry.
2. **Mobile app** (`mobile-app/`) — "Cam Cow Reports", a React Native
   (Expo) app for management. Read-only: herd, batches, finance, sales,
   health, and feed reports on their phone. No data entry — that's a
   deliberate product decision, not a missing feature. It has its own
   `package.json`, `.env`, and `README.md` — treat it as a separate project
   that happens to live in this folder and talk to the same backend.

Read `AGENTS.md` in each app before writing code in it — both pin
versions (Next.js, Expo) with breaking changes from typical training data.

## Backend API

`src/server/`, `src/routes/`, `src/controllers/`, `src/services/`,
`src/repositories/` make up a standalone Express REST API
(`src/server/index.ts`, `npm run server`) that the mobile app calls over
HTTP with JWT auth (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`,
`Authorization: Bearer <token>`). The web app mostly uses its own Next.js
server actions (`src/app/`) directly against the DB instead of this API,
so don't assume every web-app data path has a matching REST endpoint —
check `src/routes/index.ts` for what actually exists before wiring a new
mobile screen to it.

## Where things live (web app)

- `src/app/` — Next.js routes and server actions
- `src/components/` — UI, organized by domain (`InventoryTable`, `BatchTab`,
  `HealthTab`, `FeedInventoryTab`, `FinanceTab`, `AnalyticsTab`,
  `DashboardHome`, `DashboardContainer` as the top-level auth + tab shell)
- `src/types/` — one file per domain, re-exported from `src/types/index.ts`
  as `ERPLivestockData`
- `src/lib/utils.ts` — `hasPermission(currentUser, key)` and formatting
  helpers — every create/edit/delete/record/manage action in the web UI is
  gated by a `PermissionKey` (`src/types/settings.types.ts`) this way. Any
  new mutating UI must follow the same pattern.

## Where things live (mobile app — `mobile-app/`)

- `App.tsx` — root: `AuthProvider` + `RootNavigator`
- `src/context/AuthContext.tsx` — email/password login, JWT stored via
  `expo-secure-store`
- `src/api/client.ts` — talks to the backend at `EXPO_PUBLIC_API_URL`
  (must be the computer's LAN IP, not `localhost` — a phone can't resolve
  that to the dev machine)
- `src/screens/` — one file per report screen (Dashboard, Herd, Finance,
  Alerts, Batches, Farms, Growth, Sales, Health, Feed, AnimalDetail,
  Settings, More)
- `src/navigation/` — bottom tabs (Dashboard, Herd, Finance, Alerts, More)
  + a stack for drill-down screens
- See `mobile-app/README.md` for full setup/run/build instructions —
  don't duplicate it here, just point to it.
- **APK builds go through EAS Build** (`npx eas-cli build --platform
  android --profile preview`), not a local Android Studio/Gradle build —
  `eas.json` / `app.json` are already configured for it
  (`android.package: com.camcowreports.app`).

## Environment & running locally

- Web app root `.env` needs `JWT_SECRET` set (used by the auth API the
  mobile app calls) plus the usual DB connection vars — see `.env.example`.
  Run `npm run hash-passwords` once after adding `JWT_SECRET` if existing
  user passwords predate it.
- `npm run dev` (web) / `npm run server` (standalone Express API) —
  run whichever the task actually needs; they're separate processes.
- `mobile-app/.env` needs `EXPO_PUBLIC_API_URL=http://<LAN-IP>:3002/api/v1`
  — a real IP, since "localhost" from a phone means the phone itself.
- `mobile-app/` — `npm start` for Expo dev tools (scan QR with Expo Go), or
  `npm run android` for a full native build+install to an emulator/device.

## A real gotcha: don't run npm install/ci from a sandboxed shell

If you're an AI assistant working on this repo through a sandboxed/remote
shell that is NOT the user's actual Mac (e.g. a Linux VM bridged to their
machine, common in cloud coding tools), do NOT run `npm install`, `npm ci`,
or anything that touches `node_modules` from that shell — even though the
shell can see and write this project's files. `node_modules` is shared with
the real macOS host, but npm resolves *platform-specific optional
dependencies* (like `@next/swc-darwin-arm64`) based on whatever OS that
shell is actually running, not the target machine. Installing from a Linux
sandbox silently leaves the macOS native binaries as empty stubs (folder +
package.json present, no actual `.node` file), which doesn't error at
install time — it only breaks later when the user runs `next dev`/`next
build` for real on their Mac ("Failed to load SWC binary for darwin/arm64").
Ask the user to run install commands themselves in their own terminal
instead. If it's already happened: `rm -rf node_modules && npm install`
from the user's actual machine fixes it.

## Before calling anything done

1. Web app: `npx tsc --noEmit -p tsconfig.json` clean.
2. Mobile app: `cd mobile-app && npx tsc --noEmit -p tsconfig.json` clean.
3. `npx eslint <changed files>` in whichever app you touched — fix anything
   introduced by the change; pre-existing issues elsewhere aren't yours to
   fix unless asked.
4. If the change touches `mobile-app/`, re-check it against the "read-only,
   no data entry" description above and in `mobile-app/README.md` before
   considering it finished — don't add create/edit/delete flows there.

## Known loose ends (as of the last review)

Resolved in the most recent cleanup pass:
- `app.json.stray-from-eas-init-DELETE-ME` and the stray root-level
  `eas.json` (both leftovers from an `eas init`/`eas build:configure` run
  in the wrong directory) have been deleted. `mobile-app/eas.json` is the
  only EAS config this repo needs — the web app at the root has no
  expo/eas usage at all.
- `mobile-app/src/screens/AnimalDetailScreen.tsx` (per-animal detail
  screen) has been removed, along with per-animal detail in `HerdScreen`,
  `AlertsScreen`, and `HealthScreen`. The mobile app is aggregate-only
  throughout — no screen shows or links to a single animal's record.
- `Cam Cow Reports.html` (design-mockup export, gitignored) moved from
  the repo root into `design/Cam Cow Reports.html`; `.gitignore` updated
  to match.

Resolved in the full-system review pass (deploy path):
- The root `Dockerfile`/`docker-compose.yml` production path was broken: its
  `CMD` ran `npm run dev` (the dev server, not `npm start`) and only started
  the Next.js frontend — the Express backend never ran in that container at
  all, and `JWT_SECRET` was never supplied to it. Fixed by having the
  container run both processes via `pm2-runtime ecosystem.config.js` (the
  same process config the PM2/VPS deploy path already uses), so the two
  deploy paths can't drift apart. `docker-compose.yml` now maps both ports
  (3000 frontend / 3002 backend) and requires `JWT_SECRET` to be set (no
  silent empty-secret fallback) via `${JWT_SECRET:?...}`. `pm2` was added as
  a real dependency for this. No `.env` file is baked into the image anymore
  — secrets come from the environment the container is run with.
- Pre-existing `npm audit` findings on `next`, `postcss`, `sharp`, `xlsx`
  (all high severity, unrelated to the Docker fix) are still open — worth a
  deliberate look, but out of scope for this pass since some require a
  Next.js major-version bump.

Still around, and fine to leave as-is:
- `backups/prod_backup_*.json` — real production DB backups, gitignored
  on purpose (`backups/*.json` in `.gitignore`). Not stray.
- `ecosystem.config.js` (PM2, used by `scripts/deploy-production.sh`) and
  `docker-compose.yml`/`Dockerfile` (local/dev Postgres + containers)
  serve different deploy paths — both are actively used, not redundant.
- If you ever see a stray `_tmp_*.py`-style script at the repo root, it's
  session debris — safe to delete, not part of the app.

## How this `claude/` folder is used

- `features/<name>.md` — a new feature to build. See `templates/`.
- `updates/<name>.md` — a change to something already built. See
  `templates/`.
- `tests/test-<name>.md` — how to verify a flow after building/updating it.
- `templates/` — the templates for the three file types above.

Workflow: write a `features/<name>.md` (or `updates/<name>.md`) → agent
implements it → human reviews the output, fixing small things by hand or
writing a follow-up `updates/<name>.md` for anything bigger → agent (or
human) runs the matching `tests/test-<name>.md` → human verifies again.
