# Décisions d'architecture (ADR)

Une fiche par décision technique : le contexte, ce qui a été choisi, et ce que ça implique.
Les décisions produit (textes, parcours, RGPD) sont listées dans [`../PROGRESS.md`](../PROGRESS.md).

| #                                            | Décision                                                        | État    |
| -------------------------------------------- | --------------------------------------------------------------- | ------- |
| [0001](0001-astro-ssr-preact-islands.md)     | Astro en rendu serveur, Preact seulement pour l'admin           | Adoptée |
| [0002](0002-postgres-drizzle.md)             | PostgreSQL 18 + Drizzle ORM, migrations SQL versionnées         | Adoptée |
| [0003](0003-auth-admin.md)                   | Admin : argon2id, sessions en base, CSRF, limite de tentatives  | Adoptée |
| [0004](0004-csp-stricte.md)                  | CSP stricte : aucun script ni style en ligne, nonce             | Adoptée |
| [0005](0005-file-envoi-worker.md)            | File d'envoi en base + worker séparé                            | Adoptée |
| [0006](0006-rgpd-purge.md)                   | Purge RGPD automatique par le worker                            | Adoptée |
| [0007](0007-docker-caddy.md)                 | Docker Compose + Caddy (HTTPS auto), sauvegardes vérifiées      | Adoptée |
| [0008](0008-tests.md)                        | Stratégie de tests : Vitest, base réelle, Playwright 7 profils  | Adoptée |
| [0009](0009-versions-dependances.md)         | Politique de versions des dépendances                           | Adoptée |
| [0010](0010-ecrans-courts-paysage.md)        | Écrans courts, petits téléphones et paysage                     | Adoptée |
| [0011](0011-programme-et-envois-en-echec.md) | Programme de la journée, contrôle des adresses, envois en échec | Adoptée |
| [0012](0012-deploiement-continu.md)          | Déploiement continu : GitHub Actions → SSH → Docker Compose     | Adoptée |
| [0013](0013-infos-mariage-en-base.md)        | Infos du mariage en base, assistant d'installation              | Adoptée |
