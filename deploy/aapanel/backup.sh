#!/usr/bin/env bash
# Nightly Postgres backup for aaPanel — no Docker, uses local psql/pg_dump.
#
# crontab -e:
#   15 2 * * * /opt/swarmangal/deploy/aapanel/backup.sh >> /var/log/swarmangal/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."

# Load DATABASE_URL from .env next to this script's parent — the same
# connection string the app itself uses, so the backup can never drift from
# what's actually being written to (a stray POSTGRES_* var wouldn't).
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi
: "${DATABASE_URL:?DATABASE_URL is not set in /opt/swarmangal/.env}"

BACKUP_DIR="/opt/swarmangal/backups"
mkdir -p "$BACKUP_DIR"

file="$BACKUP_DIR/swarmangal-$(date +%Y%m%d-%H%M%S).dump"
pg_dump "$DATABASE_URL" -Fc -f "$file"

# Refuse to keep empty dumps
if [ ! -s "$file" ]; then
  echo "$(date -Is) backup FAILED: empty dump $file" >&2
  rm -f "$file"
  exit 1
fi

# Rotate: keep 14 days
find "$BACKUP_DIR" -name 'swarmangal-*.dump' -mtime +14 -delete
echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
