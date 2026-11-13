#!/bin/sh
# Programme la sauvegarde nocturne (BACKUP_CRON, heure de La Réunion) puis garde crond au premier plan.
set -eu
echo "${BACKUP_CRON:-0 3 * * *} /bin/sh /scripts/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] sauvegarde programmée : ${BACKUP_CRON:-0 3 * * *} (${TZ:-UTC})"
exec crond -f -l 8
