#!/bin/sh
# Backs up the database every day at BACKUP_HOUR (UTC) into /backups, keeping the last
# BACKUP_KEEP_DAYS days. Runs in the backup service of docker-compose.prod.yml, which sets the
# PG* variables. Restoring one is described in docs/deployment.md.
set -eu

hour=${BACKUP_HOUR:-4}
keep=${BACKUP_KEEP_DAYS:-7}

while true; do
  now=$(date -u +%s)
  next=$(( now / 86400 * 86400 + hour * 3600 ))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  sleep $(( next - now ))

  file="/backups/wgm-$(date -u +%Y-%m-%dT%H%M).dump"
  # Custom format: compressed, and pg_restore can restore it into an existing database.
  if pg_dump --format=custom --file="$file.partial" && mv "$file.partial" "$file"; then
    echo "Backed up to $file"
  else
    rm -f "$file.partial"
    echo "Backup failed" >&2
  fi
  find /backups -name 'wgm-*.dump' -mtime +"$(( keep - 1 ))" -delete
done
