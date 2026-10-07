# CamCow public website — handover guide

The public website for **ខេម ខោវ (CamCow)** shows member farms, cattle available and news, and
collects farm applications and price inquiries. It is fed from CC Livestock, but it **never reads
the CC Livestock database**: the office approves what may go public, and a rounded, allow-listed
*public snapshot* is the only thing the website sees.

Design documents (ask the project owner for access):

- Business requirements (BRD): requirement IDs H, M, P, C, J, N, G, D, S
- Solution functional design (SFD): tables, public API, rounding rules, badges, forms flow
- UX/UI mockup: 5 pages, "Option A · Fresh White", logo colours red `#B32C33` and green `#138E46`

## Build status

| Step | What | Status |
| --- | --- | --- |
| 1 | Office side in CC Livestock: tables, rules, permission, Website page | **Done** |
| 2 | Snapshot publisher (after each office change + every 15 min), Telegram per new request, insert-only forms account | **Done** |
| 3 | The website itself: separate project `../CamCow_Website`, http://localhost:3200 (public API `/public/v1` lives there) | **Done** |
| 4 | Forms end to end, search and sharing, speed and phone checks | To do |
| 5 | Launch: domain, HTTPS, hosting (only when the owner says so) | To do |

## Where everything is (step 1)

Every part of the feature lives in a folder or file named `website`:

```
src/
├── db/migrations/sql/021_website.sql      7 new tables + the website_requests permission
├── types/website.types.ts                 record types (profiles, consent, listings, requests, news, photos)
├── lib/website/                           RULES — pure, browser-safe, unit-tested
│   ├── access.ts                          who may publish (Super Admin, Admin) / handle requests
│   ├── places.ts                          the 25 provinces (English, Khmer, map centre)
│   ├── rounding.ts                        weight classes, "20+" counts, size ranges, blurred map pins, public codes
│   ├── listing.ts                         what a batch shows: breed, sex, class, "now" / "soon"
│   ├── badges.ts                          standards badges (feed, weighing, vet) and their thresholds
│   ├── validation.ts                      checks for every form + allowed status changes + photo limits
│   ├── snapshot.ts                        builds the public snapshot + the ALLOW-LIST of public fields
│   └── *.test.ts                          tests, incl. "no price, phone, name or id ever leaks"
├── repositories/website/                  SQL for each table (one file per table, shared.ts helpers)
├── services/website/                      business logic; every method checks the caller's role
│   ├── guards.ts                          assertWebsiteAdmin / assertRequestHandler
│   ├── website-data.ts                    loads all records the rules need (also used by the sync job)
│   ├── overview.service.ts                the Website page's data + Preview
│   ├── farm-profile.service.ts            profile, consent, publish
│   ├── batch-listing.service.ts           cattle available
│   ├── request.service.ts                 applications and inquiries
│   ├── news.service.ts                    news posts
│   └── photo.service.ts                   photo upload (+ test that refuses GPS/EXIF data)
├── app/
│   ├── website-actions.ts                 the page's server actions (all through runAction)
│   └── api/website/photos/[id]/route.ts   shows stored photos to signed-in office users
├── components/features/website/           the Website page
│   ├── WebsitePage.tsx                    tabs; shows only what the user may use
│   ├── FarmsTab.tsx                       member farms: profile, consent, on/off
│   ├── CattleTab.tsx                      cattle available: on/off, what is shown
│   ├── RequestsTab.tsx                    join applications and price inquiries
│   ├── NewsTab.tsx                        news posts
│   ├── PreviewTab.tsx                     exactly what the public will see
│   ├── PhotoPicker.tsx                    resizes photos in the browser (drops GPS data) and uploads
│   └── parts.tsx                          small shared pieces (dialog, pill, field)
└── locales/sections/websitePage.ts        all page text, English + Khmer (Khmer needs a native review)
```

Small hooks into existing files: `PermissionKey` and the permission list (`src/types/settings.types.ts`,
`src/locales/sections/permissions.ts`), the menu item (`SidebarLayout.tsx`), the tab
(`DashboardContainer.tsx`), the text registry (`src/locales/en.ts`, `km.ts`) and the table list in
`src/db/migrate.ts`.

## How it works

```
Office (Website page) ──► website_* tables ──► rules in src/lib/website ──► public snapshot
                                                                         (Preview tab today;
                                                                          sync job + website in step 2-3)
Website forms (step 2) ──► insert-only ──► website_applications / website_inquiries ──► Requests tab
```

1. A **Super Admin or Admin** sets up a farm's website profile (public name, province, district,
   optional map point, story, photos), records the farmer's **consent**, then switches it **on**.
   Publishing is refused without a current consent.
2. They switch **batches** on as "cattle available". A batch shows only while its selling date is
   within 60 days ("soon") or the sale review window / Ready to sell ("now").
3. Anyone with **`website_requests`** (Company by default; Super Admin and Admin always) answers
   applications and inquiries. Statuses only move forward.
4. **Preview** shows exactly what the public would see, built by the same rules the sync job will use.

## Rules that protect confidential data

- The snapshot holds only the fields listed in `PUBLIC_FIELDS` (`src/lib/website/snapshot.ts`).
  `snapshot.test.ts` fails if any other field, or any price, phone, owner name, internal id, note or
  exact weight, appears.
- Weights become classes, counts become "Under 10 / 10+ / 20+ / 50+", dates become "now / soon",
  sick animals are left out, totals are rounded down, map pins are blurred to about 11 km unless the
  farmer allowed the exact place, and internal ids are replaced by short public codes.
- Withdrawing consent takes the farm (and its cattle) off at once; the consent record is kept.
- Photos are re-drawn in the browser (WebP, or JPEG on Safari), which drops GPS and camera data; the
  server refuses any file that still carries EXIF or XMP.

## Settings the owner may change

| What | Where | Now |
| --- | --- | --- |
| Badge thresholds | `src/lib/website/badges.ts` | feed on 90% of 30 days; weighed within 60 days; vet record within 183 days |
| "Soon" window | `SOON_DAYS` in `listing.ts` | 60 days |
| Rounding steps | `rounding.ts` | see the functions |
| Who handles requests | Settings → Roles → "Handle website requests" | Company |

## Running and testing

```bash
npm run safe-migrate                         # applies 021_website.sql
npx vitest run src/lib/website src/services/website
npm run dev                                  # Website appears in the menu for Super Admin / Admin / website_requests
```

## Step 2: publishing and requests (in this project)

| File | What |
| --- | --- |
| `src/services/website/snapshot-publisher.service.ts` | Builds the snapshot, refuses it if any field is outside the allow-list, writes `latest.json`, keeps 7 in `history/`, copies only the photos it uses into `photos/` (and removes the rest) |
| `src/services/website/request-notify.service.ts` + `src/lib/website/notify.ts` | One plain-English Telegram message per new application or inquiry (only where alerts may be sent; claimed first so it never repeats) |
| `src/server/website-scheduler.ts` | In the API process (`npm run server`): snapshot every 15 minutes, request messages every 2 minutes |
| `src/db/migrations/sql/022_website_notify.sql` | `notified_at` on both request tables |
| `src/db/create-website-forms-user.ts` (`npm run website:forms-user`) | Creates the `camcow_website` database account: INSERT on the two request tables, nothing else |

Snapshot folder: `WEBSITE_SNAPSHOT_DIR`, default `./.website-snapshot` (git-ignored). Office changes on
the Website page publish straight away; the Preview tab has **Publish now** and shows when the site
was last published.

## Step 3: the website

A separate Next.js project next to this one: `../CamCow_Website` (see its README). Run with
`npm run dev` there, or the `camcow-website` entry in `.claude/launch.json`. It reads the snapshot
folder and posts forms with the insert-only account.
