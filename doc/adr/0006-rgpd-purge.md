# 0006 — Purge RGPD automatique

## Contexte

Les allergies sont des données de santé ; emails et téléphones sont des données personnelles.
Elles ne servent plus après le mariage (19/12/2026).

## Décision (validée par les mariés le 24/10/2026)

- Le **19/03/2027** (`site_settings.purge_at`, 3 mois après), le worker efface automatiquement
  allergies/remarques, emails, téléphones, brouillons de réponse, file d'envoi, codes à 6 chiffres et
  messages d'erreur des envois. Les **noms** (souvenir du plan de table) et l'historique des envois
  (canal, date, statut, sans adresse) sont conservés. La date d'exécution est enregistrée (`purged_at`) : la purge ne tourne qu'une fois.
- `pnpm purge` permet de la lancer à la main.
- Les journaux (application et Caddy) ne contiennent ni token de lien personnel, ni cookie, ni IP complète.
- Page `/confidentialite` : responsables, finalités, durée, droits.

## Conséquences

- Les sauvegardes antérieures à la purge contiennent encore ces données : elles disparaissent d'elles-mêmes
  par rotation (14 dernières conservées), soit environ 2 semaines après la purge.
