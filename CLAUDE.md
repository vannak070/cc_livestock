# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

CC Livestock: a cattle-fattening operations app (stock intake, batches, weights, health, feed inventory, sales/finance, analytics, proposal plans, permissions). Next.js 16 (App Router) + React 19 + PostgreSQL. UI text is bilingual (`src/locales/en.ts`, `km.ts`, `LanguageContext`); some data values are Khmer strings (e.g. farm location `រទាំង`).

`claude/config.md` has additional agent workflow notes (the `claude/features|updates|tests` spec-file workflow, deploy history). Its "mobile-app" sections are stale: `mobile-app/` was removed from this repo (commit f7a608b).

## Commands

```bash
npm run dev            # Next.js web app, port 3000
npm run server         # standalone Express API (tsx src/server/index.ts), port from PORT (3001 default, 3002 in .env/PM2)
npm run build && npm start
npm run lint           # eslint (flat config)
npm run typecheck      # tsc --noEmit
npm test               # vitest unit tests (src/**/*.test.ts)
npx vitest run src/lib/data-scope.test.ts   # a single test file
npm run test:db        # migration integration test; needs Postgres with DB_NAME ending in _test (it DROPS all tables)
npx eslint <files>     # lint only what you changed
```

DB / ops scripts (all `tsx` scripts in `src/db/`): `npm run seed`, `restore-db` (init-db.ts), `safe-migrate`, `create-admin`, `reset-password`, `set-pin`, `hash-passwords`, `db:check`, `clear-db`/`clear-stock` (destructive). Deploy: `scripts/*.sh`, PM2 via `ecosystem.config.js` (also used by the Docker image through `pm2-runtime`).

Config: copy `.env.example` to `.env`. `JWT_SECRET` is required in production; `DB_PASSWORD` is required when `NODE_ENV=production` (dev defaults to local `postgres123`, db `cc_livestock`).

Do not run `npm install`/`npm ci` from a sandboxed/remote shell that isn't the user's Mac: it breaks macOS native SWC binaries (see `claude/config.md`).

## Architecture

**Two server entry points share one backend layer.**

- **Web path (primary):** React client components call Next.js server actions in `src/app/actions.ts` -> `src/lib/db.ts` (facade) -> `services/` -> `repositories/` -> `pg` pool (`src/config/database.ts`).
- **REST path:** `src/server/` (Express, `/api/v1`) -> `routes/` -> `controllers/` -> `services/` -> `repositories/`. Built for the (now separate) mobile client; JWT bearer auth via `middleware/auth.middleware.ts`. `routes/index.ts` shows what endpoints actually exist. The web app does not necessarily have a REST equivalent for each action.
- Layering is routes -> controllers -> services -> repositories, one file per domain (stock, weight, sales, batch, health, settings, feed, proposal-plan, auth). Add new domain logic in services/repositories, not in routes or actions.
- `src/lib/db.ts` is PostgreSQL-first. `src/data/db.json` is a read-only fallback snapshot for display when the DB is unreachable; nothing is ever written to it.
- Schema: numbered idempotent SQL files in `src/db/migrations/sql/`, applied once each and recorded in the `schema_migrations` ledger by `src/db/migrate.ts` (`npm run safe-migrate`). Add a new numbered file for any schema change; never edit an applied one (checksum-enforced). One-off data/ops scripts live in `src/db/migrations/` (run via `safe-migrate` / specific scripts), not an ORM migration tool.

**Server actions go through `runAction`** (`src/lib/run-action.ts`): `runAction('Fallback error', ['perm_key'], actor => doThing(), { revalidate })` checks the session and permissions, catches errors into `{ success: false, error, status? }`, and revalidates `/` on success. Add new actions this way; do not hand-roll try/catch in `actions.ts`. Reset-on-change state (e.g. page number when filters change) uses `useOnChange` (`src/hooks/useOnChange.ts`), not a `useEffect`.

**Authorization is enforced server-side in both paths** (`src/lib/authz.ts`): the caller is re-loaded from the `users` table as an `Actor`, then `assertPermission(actor, ...PermissionKey)` is checked. The client's `hasPermission` (in `src/lib/utils.ts`) only decides what to display. Every server action starts with the session check (`requireSessionActor`), and any new mutating action or route must gate on a `PermissionKey` (`src/types/settings.types.ts`).

**Web sessions:** `src/lib/session.ts` stores the same signed JWT (`src/lib/jwt.ts`) in an httpOnly `cc_session` cookie. `src/app/page.tsx` reads it server-side, and data is trimmed per user by `scopeDataForActor` (`src/lib/data-scope.ts`) before reaching the browser: users with a `farmLocation` see only that farm's records, and only account managers get the user roster. New data fields sent to the client must pass through this scoping. The same rule is applied inside PostgreSQL first (`getDbData(scope)` and each repository's `findAll(scope)`, built from `src/lib/farm-scope.ts`), so other farms' rows are never loaded for a farm-bound user; `scopeDataForActor` still runs afterwards as a second layer. `farmMatcher` (JS) and `farmMatchSql` (SQL) must stay equivalent; `src/db/farm-scope.db.test.ts` enforces that.

**Billing (cattle registrations):** CC Livestock is billed a price per animal registered, once, in the month it is registered (`src/lib/billing.ts`, pure). Every registration writes a permanent row in `cattle_registrations` inside `stockService.createStock` (the only place cattle are created, web and REST); the row is not a foreign key, so it outlives the animal. Only a Super Admin or Admin can remove a cattle record (`stockService.deleteStock`, for registrations made by mistake): the registration is marked removed and not billed. The price list lives in `master_settings.billing` (admin-only: stripped by `redactSettingsFor`, saved only by `billingService`); billing starts in the earliest price month. The Billing page (`features/billing/BillingPage.tsx`) is Super Admin/Admin only.

**Public website (CamCow):** the office side lives in `website` folders (`src/lib/website`, `src/repositories/website`, `src/services/website`, `src/components/features/website`, `src/app/website-actions.ts`, migration 021); the public site itself is a separate Next.js app in `website/` (own package.json, port 3200, excluded from the root tsconfig/eslint; `npm run website:*`, `npm run dev:all`); start with `docs/website/README.md`. The public site may only ever see the allow-listed snapshot (`src/lib/website/snapshot.ts`); never send it anything else.

**Frontend:** `DashboardContainer` is the top-level auth + tab shell; tabs are `*Tab.tsx` components in `src/components/`, with larger domains in `components/features/{batch,feed,finance}`. Types live in `src/types/` (one file per domain) and `src/lib/types.ts`. Path alias `@/*` -> `src/*`. Styling is Tailwind v4 with Radix UI primitives, `react-hook-form` + `zod`, `recharts`, `xlsx` for import/export.

## Gotchas

- Next.js 16 differs from older versions; read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (see AGENTS.md).
- `tsconfig.json` excludes `mobile-app/` from the web TypeScript project (commit 83d9816).
- `backups/` holds real database backups and dumps (the whole folder is gitignored); don't commit or delete them.
