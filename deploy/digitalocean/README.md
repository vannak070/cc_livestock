# CC Livestock on DigitalOcean

Production for **camcow.com.kh** on the droplet **157.245.148.58** (Ubuntu 24.04, Docker). Set up 2026-10-28.

| Address | Goes to |
|---|---|
| `www.camcow.com.kh` | the CamCow public website (`website/`), main address |
| `camcow.com.kh` | forwards to `www` |
| `digital.camcow.com.kh` | the CC Livestock system app (the REST API stays inside the server) |

DNS (DigitalOcean -> Networking -> Domains -> camcow.com.kh): A records `@`, `www` and `digital` -> 157.245.148.58.
The registry delegates camcow.com.kh to ns1/ns2/ns3.digitalocean.com (done 2026-10-28).

On the server everything lives in `/opt/cc-livestock` (root only):

```
/opt/cc-livestock
├── docker-compose.yml     the four containers (copy of this folder's file)
├── .env                   secrets, generated on the server (600, never in git)
├── Caddyfile              the ACTIVE web-server config (a copy of caddy/Caddyfile.http or .https)
├── caddy/                 Caddyfile.http (phase 1, before DNS) and Caddyfile.https (phase 2)
├── scripts/               cc (everyday commands, linked as /usr/local/bin/cc), backup.sh, harden-host.sh
└── backups/               nightly database dumps, 14 days (700, files 600)
```

Four containers: `db` (PostgreSQL 16, never public), `app` (farm app :3000 + API :3002), `website` (:3200) and
`caddy` (the only public entry, :80/:443).

## Everyday commands (on the server)

```
cc status                 containers, memory, disk, last backup, HTTP/HTTPS
cc logs [service]         follow logs (app, website, db, caddy)
cc restart [service]      restart one service or all
cc backup                 database backup now (also every night at 02:00 Phnom Penh)
cc migrate | cc check     run migrations | production settings check
cc update TAG             backup, switch both images to TAG, migrate, start, wait until healthy
cc rollback TAG           go back to older images
cc https on|off           HTTPS once DNS points here (it checks DNS first) / back to HTTP
cc admin EMAIL "Name"     first Super Admin (password saved to /root/cc-livestock-admin.txt, root only)
```

## Security (hardened 2026-10-28)

- **Firewall** (`ufw`): only 22/tcp, 80/tcp, 443/tcp and 443/udp. PostgreSQL, the apps and Caddy's admin API are
  never published.
- **Networks**: the database is on an internal network with the app only (no internet, not reachable from the website
  or Caddy); the website and Caddy reach the app over a second network.
- **Database account**: the app connects as `cc_app` (`scripts/db-role.sh`, `cc db-role`), which may only read and change
  rows: it cannot create, change or drop tables, create accounts, read server files or run programs, and cannot write
  the migrations list; queries stop after 60 s. Migrations (`cc migrate`, `cc update`), backups and restores use the
  owner `DB_USER`. A one-off script that changes tables must run as the owner (see `as_owner` in `scripts/cc`).
- **Kernel** (`scripts/harden-host.sh`): no ICMP redirects or source routing, RFC 1337, no setuid core dumps.
- **SSH** (`scripts/harden-host.sh`): keys only, root by key only, 3 tries, 30 s, no X11/agent forwarding, TCP
  forwarding only for tunnels opened from the Mac (`ssh -L`). **fail2ban** bans an address after 5 failed logins in
  10 minutes (1 hour, longer for repeat offenders). The droplet saw ~1,700 bot attempts a day before.
- **Updates**: unattended-upgrades installs security updates automatically and restarts the server itself when one
  needs it, at 20:30 UTC (03:30 Cambodia, after the backup); the containers come back on their own.
- **Containers**: all `no-new-privileges`, memory caps and log limits (10 MB x 3); the two apps drop every Linux
  capability and run as non-root users; Caddy keeps only `NET_BIND_SERVICE`; Caddy's admin API is off and the
  `Server` header removed.
- **System app** (in the image): strict content security policy with a new script nonce per page load
  (`src/proxy.ts`), so injected scripts cannot run and pages cannot send data to other sites; a password change
  signs out every other phone and browser of that person (migration 035); sign-in tokens accept HS256 only.
- **Secrets**: only in `.env` (600). Images never contain `.env`, `.local/`, `backups/` or tests.
- **Backups**: kept on the server only. Copy them off now and then, or switch on DigitalOcean's weekly droplet
  backups (Droplet -> Backups) so a lost droplet does not lose the data.

The droplet is small (1 CPU, 1 GB): **images are built on the Mac** and copied over; nothing is built on the server.
Resize it to 2 GB or more for daily use, then raise the `mem_limit` values in `docker-compose.yml`.

## 1. Build the images (on the Mac, from the repo root)

```bash
TAG=$(date +%Y%m%d)
docker buildx build --platform linux/amd64 --build-arg NEXT_PUBLIC_APP_URL=https://digital.camcow.com.kh -t cc-livestock-app:$TAG --load .
docker buildx build --platform linux/amd64 --build-arg SITE_URL=https://www.camcow.com.kh -t camcow-website:$TAG --load website
```

`.dockerignore` keeps `.env`, `.local/`, `backups/` and other private folders out of the build.

Fixed in the Dockerfiles on 2026-10-28 (the first build showed each one): test files are deleted before `next build`
(some import the separate `website/`); `JWT_SECRET`/`DB_PASSWORD` get build-only placeholders on the build command
(the code refuses to load without them in production; the real ones come from `.env`); every file is made readable
(`chmod -R a+rX`, some were owner-only on the Mac); `tsconfig.json` is copied (the API's tsx needs it for `@/`
imports); `.next` is owned by the app user (Next.js writes its page and image caches there).

## 2. Copy them to the server

```bash
docker save cc-livestock-app:$TAG camcow-website:$TAG | gzip | ssh root@157.245.148.58 'gunzip | docker load'
```

Then set `APP_TAG` / `WEBSITE_TAG` in `/opt/cc-livestock/.env` to `$TAG`.

## 3. First start (done 2026-10-28)

`.env` was generated on the server with `openssl rand` secrets (see `.env.example` for the keys). Then:

```bash
cd /opt/cc-livestock
docker compose up -d db
docker compose run --rm app node_modules/.bin/tsx src/db/migrate.ts         # migrations 001-034
docker compose run --rm app node_modules/.bin/tsx src/db/check-production.ts # settings check
docker compose up -d
```

First Super Admin: `cc admin <email> "Name"`.

## 4. Switch on HTTPS (when the domain points here)

Check from anywhere: `dig +short camcow.com.kh`, `dig +short www.camcow.com.kh` and `dig +short digital.camcow.com.kh`
must all print `157.245.148.58`. Only then (failed certificate attempts get the names blocked for a while):

```bash
cc https on     # checks that all three names point here, then switches Caddy and the secure login cookie
```

## Updating later

Build and copy new images (steps 1-2), set the new tags in `.env`, then on the server:

```bash
cc update $TAG      # backup, new images, migrations, start, wait until healthy
cc rollback OLDTAG  # if needed (restore the backup too if a migration ran)
```

## Backups

`scripts/backup.sh` runs every night at 02:00 Phnom Penh time (cron, 19:00 UTC) and keeps 14 days of `pg_dump` files in
`/opt/cc-livestock/backups`. Copy them off the server regularly, for example
`scp root@157.245.148.58:/opt/cc-livestock/backups/*.dump backups/` (the Mac's `backups/` folder is gitignored).
Restore: `docker compose exec -T db pg_restore -U cc -d cc_livestock --clean < backups/<file>.dump`.

## Bringing over the real data (at go-live)

The old production server (`/root/LiveStock`, database `livestock_db`) keeps running until the switch. Then:
take a fresh `pg_dump -Fc` there, copy it here, `pg_restore` it into `cc_livestock`, run the migrations
(see `project-production-checklist` steps: duplicate AUTO-RATION rows first, billing price, built-in roles), and
point the farms to `digital.camcow.com.kh`.
