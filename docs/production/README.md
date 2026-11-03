# CC Livestock and CamCow: production guide

| | |
|---|---|
| Status | **Production, in real use** |
| Live since | 2026-10-28 (HTTPS); declared ready for production 2026-10-31 |
| Current release | `20261030d` (rollback: `20261030c`) |
| Owner | CAM COW CO., LTD |
| This document | Introduction, server information, daily operations, production and development rules, and how we handle issues, improvements and migrations from now on |

No passwords, keys or tokens are written in this document or anywhere in the code. They live only in the server's `/opt/cc-livestock/.env` (readable by root only).

---

## 1. What is in production

| Address | What it is | Who uses it |
|---|---|---|
| **https://digital.camcow.com.kh** | **CC Livestock system app**: cattle, farms, batches, weights, health, feed, costs, sales, CamCow stock, buyers, action plans, reports, billing, Website office | CamCow office, farm owners and staff (sign-in required) |
| **https://www.camcow.com.kh** | **CamCow public website**: member farms, map, cattle available, farm slide show, join and contact forms, Khmer and English | The public |
| https://camcow.com.kh | Forwards to www.camcow.com.kh | |

The system app can also be installed on phones (PWA: **Install** in the side menu).

**How the two connect.** The public website never reads the database. Every 15 minutes the system app publishes an approved *snapshot* (member farms, photos, cattle available; never prices, phone numbers or other private data). The website reads only that snapshot, through a private link inside the server. Join and contact forms go back the same way into **Website → Requests**.

---

## 2. Server information

| Item | Value |
|---|---|
| Provider | DigitalOcean (Droplet) |
| Public IP | 157.245.148.58 |
| Operating system | Ubuntu 24.04 LTS |
| Size | 1 vCPU, 1 GB memory, 2 GB swap, 24 GB disk. **Resize to at least 2 GB memory is still pending.** |
| DNS | DigitalOcean name servers (ns1/ns2/ns3.digitalocean.com); A records `@`, `www`, `digital` → 157.245.148.58 |
| HTTPS | Let's Encrypt certificates via Caddy, renewed automatically (current ones valid to 2027-01-26) |
| Folder | `/opt/cc-livestock` (root only) |
| Daily helper | `cc` (see section 4) |
| Backups | Nightly database backup 02:00 Phnom Penh (19:00 UTC), 14 days kept in `/opt/cc-livestock/backups`; plus DigitalOcean weekly backups of the whole server |
| Time zone | Server UTC; the apps use Phnom Penh time (UTC+7) |

### 2.1 What runs on the server

Four containers, managed by Docker Compose (project `cc-livestock`):

| Container | Job | Memory limit |
|---|---|---|
| `db` | PostgreSQL 16, the database. On an internal network: no internet and no access from outside | 320 MB |
| `app` | System app (Next.js) + REST API + schedulers (website publishing, Telegram alerts) | 600 MB |
| `website` | Public website (Next.js) | 350 MB |
| `caddy` | The only public entry: HTTPS, redirects, security headers | 128 MB |

```
Internet ──443/80──► caddy ──► app      (digital.camcow.com.kh)
                          └──► website  (www.camcow.com.kh) ──► app (snapshot, forms)
                                       app ──► db   (internal network only)
```

### 2.2 Security in place

- **SSH:** keys only (no passwords), at most 3 tries; fail2ban bans addresses after 5 failed logins. Only CamCow's admin Mac has a key.
- **Firewall:** only ports 22, 80 and 443 open.
- **Updates:** security updates install automatically. The server restarts itself when one needs it, at 03:30 Phnom Penh time; the containers start again on their own.
- **Containers:** no extra privileges, memory caps, log size caps.
- **Database account:** the app connects with a restricted account (`cc_app`) that can only read and change rows. Only migrations use the owner account.
- **System app:**
  - strict content security policy
  - secure sign-in cookie
  - wrong-password lockout
  - a password change signs out every other device
  - an "updated, please reload" banner after each release
- **Public website:** sees only the published snapshot; never prices or private data.

### 2.3 Settings on the server (names only)

`/opt/cc-livestock/.env` holds:
- **Database:** `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `APP_DB_USER`, `APP_DB_PASSWORD`
- **Sign-in and website link:** `JWT_SECRET`, `WEBSITE_API_KEY`
- **Addresses:** `CORS_ORIGIN`, `NEXT_PUBLIC_APP_URL`, `SITE_URL`, `TRUST_PROXY`
- **Cookie:** `SESSION_COOKIE_SECURE`
- **Release versions:** `APP_TAG`, `WEBSITE_TAG`

**Set by the owner:**
- `ANTHROPIC_API_KEY` (2026-11-03, a new key, added on the server by the owner): reading PDF and photo receipts in Cattle → Upload is on. To change it: replace the line in `.env`, then `docker compose up -d app` (a plain `cc restart` does not re-read `.env`).

**Not set yet:**
- `TELEGRAM_BOT_TOKEN`: alerts are off until it is set

---

## 3. Accounts and access

| Access | Who | How |
|---|---|---|
| System app Super Admin | athvannak070@gmail.com | Manages all other users in Settings → People |
| Server (SSH, root) | CamCow admin Mac (key) | `ssh root@157.245.148.58` |
| DigitalOcean account | CamCow owner | Droplet, DNS, weekly backups, resize |
| Domain registry (.kh) | CamCow owner | Name servers point to DigitalOcean |

Rules:
- Give each person their own account with the smallest role they need.
- Remove accounts of people who leave.
- Never share the Super Admin login.
- Never paste passwords, keys or tokens in chat or email.

---

## 4. Daily operations (`cc` on the server)

| Command | What it does |
|---|---|
| `cc status` | Containers, memory, disk, last backup, HTTPS state |
| `cc logs [app\|website\|db\|caddy]` | Follow the logs (Ctrl+C to stop) |
| `cc restart [service]` | Restart one service, or all |
| `cc backup` | Database backup now (also runs every night) |
| `cc check` | Production settings check (never prints secrets) |
| `cc migrate` | Apply database changes as the owner, then refresh the app account's rights |
| `cc update TAG` | Release: backup → switch both apps to TAG → migrate → start → wait until healthy |
| `cc rollback TAG` | Go back to an older release (programs only; the database is not rolled back) |
| `cc db-role` | Re-create the app's restricted database account and rights |
| `cc https on\|off` | Switch HTTPS (already on) |

**Quick health check from any computer:**
- **Pages:** https://digital.camcow.com.kh shows the sign-in page, and https://www.camcow.com.kh shows the home page.
- **Version:** https://digital.camcow.com.kh/api/version returns the running release ID.
- **Inside the system app:** Settings → Alerts shows whether automatic alerts run, and Website → Preview shows when the website was last published.

---

## 5. Backups and restore

1. **Nightly database dumps:** `/opt/cc-livestock/backups/cc_livestock-YYYY-MM-DD….dump`, 14 days kept, readable by root only. `cc update` also makes one before every release.
2. **DigitalOcean weekly backups:** the whole server, kept by DigitalOcean (restore from the DigitalOcean control panel).

**Restoring the database** (only after a decision by the owner; this replaces live data):
1. Announce downtime and stop the app: `docker compose stop app website`.
2. Take a fresh backup of the current state first: `cc backup`.
3. Restore the chosen dump as the owner account with `pg_restore --clean --if-exists` into the database.
4. Run `cc db-role`, start the apps with `docker compose up -d`, and check that the apps start.
5. Write down what was restored, from which date, and why.

**Recommended next:** copy backups off the server regularly (e.g. weekly download to the admin Mac or to DigitalOcean Spaces), so that two independent copies exist.

---

## 6. How releases are made

1. Changes are made and tested on the development Mac:
   - unit tests and typecheck
   - browser checks in Khmer and English, on phone and computer size
   - for risky changes, a test with a temporary account that is removed afterwards
2. Images are built on the Mac for the server (amd64): `cc-livestock-app:TAG` and `camcow-website:TAG`. Nothing is built on the small server.
3. Images are copied to the server (`docker save | ssh docker load`).
4. `cc update TAG` makes a backup, applies database changes (numbered migrations), starts the new release and waits until it is healthy.
5. Live checks: both addresses load, no errors in logs, and the changed feature works.
6. Rollback if needed: `cc rollback <previous TAG>`. A database change is not undone by rollback; it would need a restore (section 5).

**Release tag format:** date plus a letter, e.g. `20261030d` (fourth release on 30 Oct 2026).

**Release window:** outside working hours where possible (before 07:00 or after 19:00 Phnom Penh). Open pages show "CC Livestock was updated, Reload" after a release.

---

## 7. Working on production from now on

Production holds real business data, so **nothing on the production server is changed without the owner's explicit request**. This includes settings, data, users, releases, restarts and backups restores.

### 7.1 Kinds of work

| Kind | Examples | How it is handled |
|---|---|---|
| **Issue / bug** | Something does not work, wrong number, error message, site down | Report it (7.2). Investigation is read-only first (logs, checks). The fix is built and tested on the Mac, then released with the owner's OK |
| **System improvement** | New feature, new report, design change, performance, security | Describe the need. A short proposal (what changes, who is affected, any data change) is approved before work starts. Built and tested on the Mac, released with the owner's OK |
| **Data migration** | Bringing data from the old server, importing farms/cattle from Excel, cleaning data | Written plan first: source, steps, backup, test run on a copy, checks, and downtime if any. Run only on an agreed date, with a backup just before |
| **Server / infrastructure** | Resize, new keys or tokens, domain change, off-site backups | Done in the DigitalOcean panel by the owner where possible; anything on the server only with the owner's OK and a backup first |

### 7.2 How to report an issue

Send:
- **What happened and what you expected**
- **Where:** address and page (e.g. digital → Cattle → Upload)
- **Who:** account or role, and phone or computer
- **When:** date and time
- **Evidence:** a screenshot or photo of any message
- **How urgent:**

| Level | Meaning | Target |
|---|---|---|
| **Critical** | Site down, nobody can sign in, data looks lost or wrong for everyone | Same day; rollback first if a release caused it |
| **High** | One important function broken (e.g. cannot record feed or weights), no work-around | Next working day |
| **Normal** | Something works badly or there is a work-around | Next planned release |
| **Request** | Improvement or new idea | Planned with the owner |

### 7.3 Production rules

**Hands-off**
1. Nothing on the production server is changed without the owner's explicit request for that action. This covers releases, restarts, settings, data edits, user accounts and backup restores.
2. Even read-only checks on the server (logs, status) are done only with the owner's OK.
3. Nothing about production is shared. Passwords, keys and tokens never go in chat, email, screenshots, documents or code. They live only in the server's `.env` (root only).

**Fixing a production problem**
1. A request to fix a live problem is not permission to work on the server. The work starts on the Mac.
2. Reproduce the problem on the Mac: recreate the situation in the local data (for example an Admin account tied to a farm) instead of looking into production.
3. Fix it and test it on the Mac (see below), then show the owner the result.
4. Release only after the owner says yes to the release itself. When it is done, production is hands-off again.
5. If the cause cannot be found on the Mac, ask the owner before any look at the server, even a read-only one.

**Every change (after approval)**
1. **Test on the Mac first,** never on live data: tests, typecheck and lint pass, and a browser check in Khmer and English at phone and computer size.
2. **Temporary admin accounts:** a test that needs an admin uses a temporary account on the Mac, only after the owner agrees. It is deleted afterwards, together with its password file.
3. **Backup first:** `cc update TAG` always takes a database backup before switching; anything else gets a manual `cc backup`.
4. **Know the way back:** every release has a rollback version written down (`cc rollback TAG`).
5. **Check after release:** both addresses, the logs, and the changed function on the live site.
6. **Release window:** before 07:00 or after 19:00 Phnom Penh where possible.
7. **Keep this guide current:** release history, server changes and open items.

**Data and database**
1. **Structure changes only through new numbered migration files** in `src/db/migrations/sql/` (the next one is `038`). An applied migration is never edited or deleted (checksums are enforced).
2. **Owner vs app account:** migrations run as the owner account (`cc migrate`). The app runs as the restricted `cc_app` account, which cannot change tables.
3. **No hand edits:** live data is never edited by hand without a written reason and a backup first.
4. **Data migrations:** a written plan, a test run on a copy, then a date agreed with the owner.
5. **Unused tables are kept** (left unread) rather than dropped, because deleting data cannot be undone.

**Issues**
1. **Urgency levels** as in 7.2:
   - Critical: same day; roll back first if a release caused it.
   - High: next working day.
   - Normal and Requests: the next planned release.
2. **Investigation is read-only first.** The fix is built and tested on the Mac, then released with the owner's OK.

---

## 8. Development rules (the development Mac)

**Environment**
1. **Local stack:** database (Docker, port 5433), system app :3000, API :3003, website :3200. `.claude/start-dev.sh` starts them at the start of each work session and reuses running ones.
2. **Parallel work sessions:**
   - Files are re-read before editing.
   - Another session's servers are not stopped without reason.
   - Git stash or git remove are never used.
   - Work another session just touched is not taken over without asking.
3. **No `npm install` from a sandboxed or remote shell,** because it breaks the Mac's native build tools. Dependencies are installed on the Mac itself.
4. **Test data:**
   - Test logins (Office, Staff, Management) are kept in `.local/`, never in the code.
   - `npm run seed` is never used.
   - Database integration tests run only on a separate `_test` database (they delete all tables).

**Code**
1. **Server actions** go through `runAction`, with the session and permission checked on the server. New mutating actions or API routes need a permission key.
2. **Data sent to the browser** passes the farm scoping, so a farm user sees only their own farm. The SQL and JavaScript farm rules must stay equal (there is a test for that).
3. **Layering:** new business logic goes in `services/` and `repositories/`, with unit tests, not in pages or routes.
4. **Languages:** every screen and message has Khmer and English text.
5. **Public website:**
   - It is a separate app in `website/` and never imports system app code.
   - It sees only the allow-listed snapshot: no prices, phone numbers, money or other private data.
   - Its look: white cards, thin lines, one red button per page, Kantumruy Pro for Khmer.
6. **Owner decisions that stay:**
   - no paid/unpaid tracking for CamCow buyers
   - nothing from the website's "removed, never re-add" list
   - no farmer FAQ and no price form

**Before calling work done**
1. Tests, typecheck and lint pass.
2. Anything visible is checked in the browser, with screenshots or results shown.
3. The report states exactly what was and was not checked.
4. Notes are kept of what was done and what waits on the owner.

---

## 9. Open items (not done yet)

| Item | Why it matters | Who |
|---|---|---|
| **Resize the server to 2 GB memory** | 1 GB is tight for both apps plus the database under real use | Owner (DigitalOcean panel, about 2 minutes of downtime), then raise the memory limits |
| **Telegram bot token** | Turns on farm alerts (low feed, selling reminders, long stay, late tasks) | Owner creates a new token; it is put on the server without pasting it in chat |
| **New Anthropic API key** | Turns on reading PDF and photo receipts in Cattle → Upload | Owner (the old key was pasted in chat: delete it) |
| **Data from the old server** | The new production database started empty. Decide: bring the old records (cattle, farms, history) or start fresh | Owner decides. If bringing it: SSH access to the old server or a fresh database export, a date, and a written plan (backup, clean duplicates, migrations 001-037, checks) |
| **Off-server backup copies** | A second, independent copy of the database | Owner chooses where (admin Mac, DigitalOcean Spaces) |
| **Sharper website pictures** | The three built-in farm pictures are small; SNR Farm's only photo is its logo | Owner uploads photos of at least 1600 × 1200 in Website → Pictures and Member farms |
| **Phone install check** | Install and Share (QR) not yet tried on the live address | Quick check on a phone |
| **Billing price** | Billing shows "Set the price" until a price per animal is entered | Super Admin, Billing page |

---

## 10. Where to find more

| Topic | File |
|---|---|
| Server setup, structure, `cc` helper | `deploy/digitalocean/README.md` |
| Security settings | `docs/production-security.md` |
| Public website (office side) | `docs/website/README.md` |
| Code structure and commands | `CLAUDE.md` |
| E-commerce project (planned) | `docs/ecommerce/business-requirements.md` |

### Release history (recent)

| Tag | Date | Change |
|---|---|---|
| 20261103a | 2026-11-03 | Cattle → Upload: arrival date per animal in the check list (starts at the receipt date); wider Breed/Sex boxes |
| 20261102d | 2026-11-02 | Office app: plain white/black strips are cut off website photos when they are added (new uploads only) |
| 20261102c | 2026-11-02 | Website: member list and "Other member farms" cards with a wide, sharp picture on top (posters show their photo part) |
| 20261102b | 2026-11-02 | Common server messages (own-farm, no permission, session expired) shown in Khmer when Khmer is chosen |
| 20261102a | 2026-11-02 | Fix: Admin could not add a farm (office roles were tied to the only farm); migration 038 removes farms from office accounts |
| 20261030e | 2026-10-30 | Sign-out after 60 minutes without activity (5-minute warning, 12-hour longest sign-in, Super Admin can change it in Settings → Sign-in); everyone signed in again once |
| 20261030d | 2026-10-30 | Sharper website images (quality 85), sharper photo uploads |
| 20261030c | 2026-10-30 | Website pages always fresh (no hard refresh), map start fix |
| 20261030b | 2026-10-30 | "CC Livestock was updated, Reload" banner |
| 20261030a | 2026-10-30 | Home farm slide show (farm photos only); Beef prices page removed |
| 20261028f | 2026-10-28 | Beef prices page (later removed) |
| 20261028e | 2026-10-28 | Website → Pictures (replace built-in pictures) |
| 20261028d | 2026-10-28 | Security release: strict CSP, sessions end on password change |
