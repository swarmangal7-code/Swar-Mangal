#!/usr/bin/env bash
# One-time copy of the Railway Postgres into the VPS's aaPanel-managed Postgres.
#
#   RAILWAY_DATABASE_URL='postgresql://...' ./migrate-from-railway.sh
#
# Use Railway's PUBLIC connection string (DATABASE_PUBLIC_URL). Run it BEFORE
# the app has taken any real writes on the VPS: it replaces the VPS database.
# Railway itself is only read from and stays untouched as a fallback.
#
# Reads DATABASE_URL (the VPS's aaPanel Postgres) from /opt/swarmangal/.env —
# the same file the app itself uses. No Docker Postgres is involved; this
# only uses `docker run` as a portable way to get pg_dump/pg_restore without
# requiring the postgresql-client package to be installed on the VPS.
set -euo pipefail
APP_DIR="/opt/swarmangal"
: "${RAILWAY_DATABASE_URL:?set RAILWAY_DATABASE_URL to the Railway public Postgres URL}"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "missing $APP_DIR/.env — copy deploy/.env.example there and fill it in first" >&2
  exit 1
fi
set -a; . "$APP_DIR/.env"; set +a
: "${DATABASE_URL:?DATABASE_URL is not set in $APP_DIR/.env}"

mkdir -p "$APP_DIR/backups"
dump="$APP_DIR/backups/railway-$(date +%Y%m%d-%H%M%S).dump"

echo "1/4 dumping Railway (read-only) -> $dump"
docker run --rm -e PGSSLMODE=require postgres:17 \
  pg_dump "$RAILWAY_DATABASE_URL" -Fc --no-owner --no-privileges > "$dump"
[ -s "$dump" ] || { echo "dump is empty, stopping"; exit 1; }

echo "2/4 stopping the app and sheets worker so nothing writes during the restore"
pm2 stop swarmangal-app swarmangal-sheets

echo "3/4 restoring into the VPS database (drops and recreates it first)"
# --network=host lets the container reach aaPanel's Postgres on 127.0.0.1.
docker run --rm --network=host -e PGPASSWORD -v "$dump":/dump.bin:ro postgres:17 bash -c '
  set -euo pipefail
  url="$1"
  db="$(echo "$url" | sed -E "s#.*/([^/?]+).*#\1#")"
  base="$(echo "$url" | sed -E "s#(.*)/[^/?]+(\?.*)?#\1/postgres#")"
  psql "$base" -c "drop database if exists \"$db\" with (force);"
  psql "$base" -c "create database \"$db\";"
  pg_restore "$url" --no-owner --no-privileges /dump.bin
' _ "$DATABASE_URL"

echo "4/4 starting the app (applies schema + migrations) and the sheets worker"
pm2 start swarmangal-app swarmangal-sheets
sleep 15
cd "$APP_DIR" && node sync/worker.mjs --backfill
echo "done. Watch ongoing sync with: pm2 logs swarmangal-sheets"
