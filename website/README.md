# ខេម ខោវ (CamCow) public website

The public website for CamCow: member farms on a map, cattle available, news, and two forms
(join as a member farm, ask for a price). **English first for now**; the Khmer text is ready in `src/lib/i18n/km.ts` and comes back by adding `'km'` to `ENABLED_LANGS` in `src/lib/i18n/langs.ts` after a native review. Design: "Option A ·
Fresh White" with the logo's colours, red `#B32C33` and green `#138E46`.

This app lives in the `website/` folder of the CC Livestock repo but is a separate app: its own
`package.json`, `node_modules`, `.env.local` and port, and it never imports CC Livestock code.

**It never reads the CC Livestock database.** CC Livestock publishes an approved, rounded
*snapshot* (a folder with `latest.json` and photos). This site reads only that folder. The two
forms write new rows through a database account that can only insert into two tables.

```
CC Livestock (office)                         This website (public)
  Website page ─► rules + allow-list           reads  ../.website-snapshot/latest.json + photos/
  publisher ─► .website-snapshot/  ─────────►  pages, /public/v1 API, /photos
  Requests tab ◄─ website_applications ◄─────  forms (insert-only account camcow_website)
             └─ Telegram message per request
```

## Run it locally

```bash
cp .env.example .env.local     # then fill in (see below)
npm install                    # or, from CC Livestock: npm run website:install
npm run dev                    # http://localhost:3200 (or from CC Livestock: npm run website:dev, or dev:all for everything)
```

`.env.local`:

| Setting | What |
| --- | --- |
| `CAMCOW_SNAPSHOT_DIR` | Optional. The snapshot folder; leave it out to use `../.website-snapshot` (CC Livestock's). Set it in production if the site runs from another folder |
| `FORMS_DATABASE_URL` | The insert-only account. Create it in CC Livestock: `WEBSITE_FORMS_DB_PASSWORD=... npm run website:forms-user` |
| `SITE_URL` | This site's address (share links, sitemap, allowed form origin) |

Nothing shows on the map until an office admin publishes a farm in CC Livestock (Website page →
Member farms: profile, consent, Put on the website).

## Where everything is

```
src/
├── proxy.ts                         "/" opens the default language (English, /en)
├── app/
│   ├── [lang]/                      every page, per language (/en now; /km when switched on)
│   │   ├── layout.tsx               fonts, header, footer, page titles
│   │   ├── page.tsx                 Home: hero, live numbers, tabs, journey, map, standards, cattle, stories
│   │   ├── members/                 Farmer Members map + list, and each farm's profile ([slug])
│   │   ├── cattle/                  Cattle available + price form
│   │   ├── join/                    Join as a member farm + application form
│   │   ├── news/                    Stories list and each story ([id])
│   │   └── contact/
│   ├── public/v1/                   public API: summary, farms, farms/[slug], cattle, news (GET); applications, inquiries (POST)
│   ├── photos/[file]/               snapshot photos
│   └── sitemap.ts, robots.ts
├── components/
│   ├── layout/                      Header (menu, language switch), Footer
│   ├── home/                        LiveRecords (count-up), AudienceTabs, HomeMap
│   ├── members/                     MembersMap (Leaflet + OpenStreetMap), MembersExplorer (filters: province, breed, cattle available, new members = member since last year)
│   ├── cattle/                      CattleExplorer (filters), InquiryForm
│   ├── join/                        ApplicationForm
│   └── shared/                      PageHead, HeroLines, Photo, Reveal
├── lib/
│   ├── snapshot/                    types (keep the same as CC Livestock) + reading the snapshot
│   ├── forms/                       validate (shared by browser and server, tested), rate-limit, db (insert-only)
│   ├── i18n/                        km.ts and en.ts: every word on the site; langs.ts: links per language
│   ├── api/respond.ts               JSON answers, CORS, origin check
│   ├── contact.ts                   phone, Telegram, Facebook (change here only)
│   ├── places.ts                    the 25 provinces
│   ├── districts.ts                 suggested districts for the Join form (same list as CC Livestock's src/lib/website/districts.ts)
│   └── page.ts                      reads the language from the address
└── styles/globals.css               colours, layout, motion (all off with reduced motion)
```

## Rules to keep

- Show only what is in the snapshot. Never add a database read here.
- Never show a price: buttons say "Ask for price" and go to the form.
- Keep `src/lib/snapshot/types.ts` the same as CC Livestock's `src/lib/website/snapshot.ts`.
- All text lives in `src/lib/i18n/km.ts` and `en.ts`. The Khmer was drafted by Claude and needs a native speaker's review before launch.
- Forms: checks in `src/lib/forms/validate.ts` run in the browser and again on the server; a hidden
  "website" field catches robots; 5 sends an hour per address; only this site's origin is accepted.
  Reads of `/public/v1` are limited to 60 a minute per address (429 + Retry-After). Both limits are in
  memory (`lib/forms/rate-limit.ts`): fine for one server; behind a proxy, set x-forwarded-for.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Step 4 (done 2026-10-07)

- Join form photos: up to 3, resized in the browser (location data removed), checked again on the
  server (`src/lib/forms/photos.ts`), saved with the application in one transaction. The forms
  account may now also INSERT into `website_photos`.
- Share previews: `src/lib/og.tsx`, `app/[lang]/opengraph-image.tsx` (site) and
  `members/[slug]/opengraph-image.tsx` (farm name). Latin text only (the image font has no Khmer).
- Phone check at 375 px: no page scrolls sideways; Join page has an "Apply now" jump button.
- Production build passes; home page ≈ 10 KB HTML + 7 KB CSS + 200 KB JS (gzip).

## Not done yet

- Real photos and a drone video (empty photo frames show the faded logo until then).
- Telegram link in `src/lib/contact.ts` (empty until the owner gives one).
- Khmer review, then add 'km' to `ENABLED_LANGS`.
- Launch: domain, HTTPS, hosting, the snapshot folder shared with the host (or copied to storage),
  and `FORMS_DATABASE_URL` pointing at production. Only when the owner says so.
