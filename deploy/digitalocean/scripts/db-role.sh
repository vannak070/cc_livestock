#!/bin/sh
# Creates or refreshes the restricted database account the app runs as (APP_DB_USER, default cc_app). Run by `cc db-role`
# and after every migration by `cc update` / `cc migrate`. Re-runnable.
#
# The app account may only read and change rows (SELECT, INSERT, UPDATE, DELETE, and use the id sequences). It is not a
# superuser and owns nothing, so a bug that let someone run their own SQL could not drop or alter tables, create
# accounts, read server files or run programs (COPY ... PROGRAM). schema_migrations is read-only to it. A query that
# runs over 60 s, or a transaction left open 5 min, is stopped. Migrations, backups and restores keep using the owner
# account (DB_USER), which the db container created on its first start.
# The password lives only in .env (600) and reaches psql on stdin, never on a command line.
set -eu
cd /opt/cc-livestock

env_val() { grep "^$1=" .env | head -1 | cut -d= -f2-; }
set_env() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }

OWNER=$(env_val DB_USER); DB=$(env_val DB_NAME)
APP=$(env_val APP_DB_USER); [ -n "$APP" ] || { APP=cc_app; set_env APP_DB_USER "$APP"; }
PW=$(env_val APP_DB_PASSWORD); [ -n "$PW" ] || { PW=$(openssl rand -hex 24); set_env APP_DB_PASSWORD "$PW"; }
case "$APP$PW" in *[!A-Za-z0-9_]*) echo "APP_DB_USER/APP_DB_PASSWORD may only use letters, digits and _"; exit 1 ;; esac
[ "$APP" != "$OWNER" ] || { echo "APP_DB_USER must differ from DB_USER"; exit 1; }

docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U "$OWNER" -d "$DB" <<SQL
SELECT 'CREATE ROLE $APP' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$APP') \gexec
ALTER ROLE $APP WITH LOGIN PASSWORD '$PW' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 40;
ALTER ROLE $APP SET statement_timeout = '60s';
ALTER ROLE $APP SET idle_in_transaction_session_timeout = '5min';
REVOKE ALL ON DATABASE "$DB" FROM PUBLIC;
GRANT CONNECT ON DATABASE "$DB" TO $APP;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO $APP;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $APP;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO $APP;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE schema_migrations FROM $APP;
ALTER DEFAULT PRIVILEGES FOR ROLE $OWNER IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP;
ALTER DEFAULT PRIVILEGES FOR ROLE $OWNER IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $APP;
SQL
echo "database account $APP: rows only (read, add, change, delete); owner $OWNER keeps the tables"
