# 0007 — Docker Compose, Caddy et sauvegardes

## Contexte

Hébergement sur un petit serveur (VPS) administré par des non-développeurs, sans domaine choisi au départ.

## Décision

- **Dev** (`docker-compose.yml`) : `db`, `migrate`, `app` (rechargement à chaud), `worker`, `mailpit`
  (boîte mail de test), `adminer` (profil `tools`). Au premier démarrage, Postgres crée aussi la base
  de test `mariage_test` (`docker/db-init/`).
- **Prod** (`docker-compose.prod.yml`) : image multi-étapes non root (`node:26-alpine`), `migrate` unique,
  `app`, `worker`, **Caddy 2.11** (HTTPS Let's Encrypt automatique pour `DOMAIN`, HSTS, journaux filtrés)
  et `backup`.
- **Sauvegardes** chaque nuit à 3 h (heure de La Réunion) : `pg_dump` + archive des photos,
  **restauration vérifiée** dans une base temporaire à chaque fois, 14 dernières conservées.
  `make restore FILE=…` / `pnpm restore` sauvegarde l'état actuel avant de restaurer.

## Conséquences

- Les sauvegardes restent sur le même serveur : les copier ailleurs régulièrement (voir `doc/CONFIGURATION.md`).
- L'image de sauvegarde doit avoir la même version majeure de PostgreSQL que la base (18).
