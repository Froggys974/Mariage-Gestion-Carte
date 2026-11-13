#!/bin/sh
# Vérifie qu'une sauvegarde se restaure : restauration dans une base jetable, contrôle, suppression.
set -eu
FILE="$1"
CHECK_DB="restore_check_$$"
cleanup() { dropdb --if-exists "$CHECK_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
createdb "$CHECK_DB"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$CHECK_DB" "$FILE"
COUNT="$(psql --dbname="$CHECK_DB" -At -c 'select count(*) from invitation')"
TABLES="$(psql --dbname="$CHECK_DB" -At -c "select count(*) from information_schema.tables where table_schema='public'")"
if [ "$TABLES" -lt 10 ]; then
  echo "[backup] ✗ restauration incomplète ($TABLES tables)" >&2
  exit 1
fi
echo "[backup] ✓ restauration vérifiée : $TABLES tables, $COUNT invitations"
