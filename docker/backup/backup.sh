#!/bin/sh
# Sauvegarde : pg_dump (format custom) + archive des photos, vérification de la restauration,
# conservation des BACKUP_KEEP dernières (14 par défaut).
set -eu
DIR=/backups
KEEP="${BACKUP_KEEP:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"

echo "[backup] $TS : sauvegarde de la base ${PGDATABASE}"
pg_dump --format=custom --no-owner --no-privileges --file="$DIR/mariage-$TS.dump.tmp" "$PGDATABASE"
mv "$DIR/mariage-$TS.dump.tmp" "$DIR/mariage-$TS.dump"

if [ -d /data/uploads ]; then
  tar -czf "$DIR/uploads-$TS.tar.gz" -C /data uploads
fi

/bin/sh /scripts/verify-restore.sh "$DIR/mariage-$TS.dump"

# rotation : on garde les KEEP plus récentes de chaque type
for pattern in 'mariage-*.dump' 'uploads-*.tar.gz'; do
  # shellcheck disable=SC2012
  ls -1t $DIR/$pattern 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
    echo "[backup] supprimée : $(basename "$old")"
  done
done
echo "[backup] terminé : mariage-$TS.dump ($(du -h "$DIR/mariage-$TS.dump" | cut -f1))"
