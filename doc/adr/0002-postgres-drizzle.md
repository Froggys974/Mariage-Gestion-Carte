# 0002 — PostgreSQL 18 + Drizzle ORM

## Contexte

Quelques centaines d'invités, mais des écritures concurrentes (brouillons de réponse, envois, plan de
table) et des contraintes d'intégrité fortes (pas de doublon de convive, une seule version active du plan).

## Décision

- **PostgreSQL 18** (image `postgres:18-alpine`), même version en dev, CI et production.
- **Drizzle ORM** + driver **postgres.js** ; le schéma est dans `src/lib/db/schema.ts`.
- Migrations SQL versionnées dans `drizzle/` (générées par `pnpm db:generate`, relues, puis commitées),
  appliquées par le service `migrate` **une seule fois** avant `app` et `worker`.
- Contraintes en base plutôt qu'en code quand c'est possible : index uniques (token, convive par place,
  plan actif unique), verrou optimiste `updated_at` sur les réponses (`409 conflict`).
- Valeurs par défaut (carte, réglages, invitation système « Les mariés ») créées par `ensureSingletons`.

## Conséquences

- Passage de PostgreSQL 16 à 18 (28/10/2026, site pas encore en ligne) : le volume s'appelle désormais
  `pg18data` et l'image 18 le monte sur `/var/lib/postgresql`. L'ancien volume `pgdata` n'est plus
  utilisé (il n'est pas supprimé automatiquement).
- Une future montée de version majeure de PostgreSQL se fait par sauvegarde/restauration
  (`pg_dump` → nouveau volume → `pg_restore`), voir `doc/CONFIGURATION.md`.
