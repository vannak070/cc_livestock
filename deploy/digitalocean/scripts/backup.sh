#!/bin/sh
# Nightly database backup on the droplet (cron, 02:00 Phnom Penh = 19:00 UTC). Keeps 14 days in /opt/cc-livestock/backups
# (folder 700, files 600). Copy them off the server now and then (`scp root@157.245.148.58:/opt/cc-livestock/backups/*.dump
# backups/` on the Mac), or switch on DigitalOcean's weekly droplet backups.
set -eu
umask 077
cd /opt/cc-livestock
. ./.env
STAMP=$(date -u +%Y%m%d-%H%M)
mkdir -p backups && chmod 700 backups
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "backups/cc_livestock-$STAMP.dump"
find backups -name 'cc_livestock-*.dump' -mtime +14 -delete
echo "$(date -u '+%F %T') backup ok: $(du -h "backups/cc_livestock-$STAMP.dump" | cut -f1)"
