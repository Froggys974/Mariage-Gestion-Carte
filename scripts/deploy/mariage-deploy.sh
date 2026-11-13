#!/bin/sh
# Déploiement du site sur le serveur. Installé en /usr/local/bin/mariage-deploy (voir doc/CONFIGURATION.md § 8).
#
# C'est la SEULE commande que la clé SSH de GitHub peut lancer (« command=… » dans
# /home/deploy/.ssh/authorized_keys) : elle lit sur l'entrée standard l'archive du dépôt (git archive),
# remplace le code de /opt/mariage puis reconstruit et redémarre le site.
# Jamais touchés : le fichier .env (secrets) et les données (volumes Docker : base, photos, sauvegardes).
set -eu

APP=/opt/mariage
exec 9>/tmp/mariage-deploy.lock
flock -n 9 || { echo "Un déploiement est déjà en cours." >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "→ Réception du code"
tar -xzf - -C "$TMP"
[ -f "$TMP/docker-compose.prod.yml" ] || { echo "Archive invalide : docker-compose.prod.yml absent." >&2; exit 1; }

echo "→ Remplacement du code (le fichier .env est conservé)"
find "$APP" -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} +
cp -a "$TMP"/. "$APP"/

if [ ! -f "$APP/.env" ]; then
  echo "Code installé, mais $APP/.env n'existe pas encore : créez-le (doc/CONFIGURATION.md § 4)," >&2
  echo "puis relancez le déploiement depuis GitHub (Actions → Déploiement → Run workflow)." >&2
  exit 2
fi

cd "$APP"
echo "→ Construction et redémarrage (5 à 10 minutes)"
docker compose up -d --build --remove-orphans

echo "→ Ménage des anciennes images"
docker image prune -f >/dev/null
docker builder prune -f --filter until=72h >/dev/null || true

docker compose ps
echo "✓ Déploiement terminé"
