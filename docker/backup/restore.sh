#!/bin/sh
# Restaure une sauvegarde dans la base de production.
# Usage (depuis le serveur) : make restore FILE=mariage-AAAAMMJJ-HHMMSS.dump
# Une sauvegarde de l'état actuel est faite juste avant, au cas où.
set -eu
DIR=/backups
NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Indiquez le fichier à restaurer. Sauvegardes disponibles :"
  ls -1t "$DIR"/mariage-*.dump 2>/dev/null | xargs -n1 basename || true
  exit 2
fi
FILE="$DIR/$(basename "$NAME")"
[ -f "$FILE" ] || { echo "Fichier introuvable : $FILE" >&2; exit 2; }

/bin/sh /scripts/verify-restore.sh "$FILE"
SAFETY="$DIR/avant-restauration-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$SAFETY" "$PGDATABASE"
echo "[restore] état actuel sauvegardé : $(basename "$SAFETY")"

pg_restore --no-owner --no-privileges --clean --if-exists --single-transaction --exit-on-error --dbname="$PGDATABASE" "$FILE"
UPLOADS="$DIR/uploads-$(basename "$FILE" .dump | sed 's/^mariage-//').tar.gz"
if [ -f "$UPLOADS" ]; then
  find /data/uploads -mindepth 1 -delete
  tar -xzf "$UPLOADS" -C /data
  echo "[restore] photos restaurées depuis $(basename "$UPLOADS")"
fi
echo "[restore] ✓ base restaurée depuis $(basename "$FILE")"
