# 0001 — Astro en rendu serveur, Preact seulement pour l'admin

## Contexte

Le site invité est consulté surtout sur téléphone, parfois en 4G faible à La Réunion. Il doit être très
léger, mais il a besoin d'un serveur : liens personnels `/i/<token>`, réponses, espace admin.
Les animations du prototype (scènes en profondeur, table 3D CSS, enveloppe) sont en JS natif.

## Décision

- **Astro 7** en `output: 'server'` avec l'adaptateur **@astrojs/node** (mode `standalone`).
- **Site invité sans framework** : modules TypeScript natifs (`src/features/*/client/*.ts`) chargés
  par des balises `<script>` Astro. Budget : 60 Ko de JS compressé (`pnpm budget:js`), environ 19 Ko aujourd'hui.
- **Preact** uniquement pour les îlots de l'admin (`src/features/*/islands/*.tsx`) : listes, éditeur
  de carte, plan de table.
- Code rangé **par fonctionnalité** (`src/features/rsvp`, `admin`, `card`, `seating`, `messaging`,
  `invitation`) ; le code partagé est dans `src/lib`. Tous les textes visibles sont dans `src/content/fr.ts`.
- `compressHTML: true` est fixé explicitement : Astro 7 a changé la valeur par défaut (`'jsx'`), ce qui
  supprime les espaces entre éléments en ligne et changerait le rendu fidèle à la maquette.

## Conséquences

- Pas d'hydratation côté invité : chargement rapide, mais la logique client est écrite à la main
  (et testée unitairement : `scene-nav`, `table3d`, `rsvp-ui`, `draft-sync`…).
- `src/server/start.ts` valide la configuration avant de démarrer Astro (message clair si une variable manque).
