# 0009 — Politique de versions des dépendances

## Décision

- Versions **exactes** dans `package.json` (pas de `^`) + `pnpm-lock.yaml` commité ; installation en
  `--frozen-lockfile` dans Docker et en CI.
- pnpm attend 24 h avant d'accepter une version fraîchement publiée (`minimumReleaseAge`, protection contre
  les paquets compromis). Exemple : `astro` 7.4.3, publié le 28/10/2026, sera pris à la mise à jour suivante.
- **Node LTS active** partout (Docker, CI) : Node 26 depuis le 07/11/2026 (Node 24 passe en maintenance) ; `@types/node` suit la version de Node utilisée, pas la dernière.
- **TypeScript 6.0** et non 7.0 : au 28/10/2026, TypeScript 7 (compilateur natif) n'a pas encore d'API
  stable ; `astro check` et `typescript-eslint` (≤ 6.0) le refusent. Passer à 7.x quand ces deux outils
  le supporteront (attendu avec TypeScript 7.1).

## Mise à jour du 28/10/2026

| Paquet                 | Avant                                          | Après                                          | Points d'attention                                                 |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| astro                  | 5.18.2                                         | 7.4.2                                          | compilateur Rust, Vite 8, `compressHTML` forcé à `true` (ADR 0001) |
| @astrojs/node / preact | 9 / 4                                          | 11 / 6                                         | —                                                                  |
| preact                 | 10.29                                          | 11.1.0                                         | types `useRef` plus stricts (aucun changement nécessaire ici)      |
| nodemailer             | 7.0.13                                         | 10.2.1                                         | types fournis : `@types/nodemailer` retiré                         |
| eslint / @eslint/js    | 9.39                                           | 10.13 / 10.0                                   | `defineConfig` d'`eslint/config` ; règle `no-useless-assignment`   |
| typescript             | 5.9.3                                          | 6.0.3                                          | `baseUrl` retiré de `tsconfig.json` (déprécié)                     |
| vitest                 | 3.2.7                                          | 5.0.5                                          | —                                                                  |
| @types/node            | 22                                             | 24                                             | aligné sur Node 24 LTS                                             |
| Images Docker          | node 22, postgres 16, caddy 2.10, mailpit 1.27 | node 24, postgres 18, caddy 2.11, mailpit 1.32 | nouveau volume `pg18data`                                          |
| API WhatsApp (Meta)    | v21.0                                          | v26.0                                          | la v21 expire le 21/01/2027                                        |

## Mise à jour du 07/11/2026

| Paquet                       | Avant                  | Après                  | Points d'attention                                                                                                         |
| ---------------------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Node (Docker, CI)            | 24                     | 26                     | Node 26 est LTS active depuis le 28/10/2026 ; `@types/node` 24 → 26                                                        |
| astro                        | 7.4.2                  | 7.4.7                  | rolldown 1.3 tire `@emnapi` 2.0.0-beta : figé en 1.11.3 (`overrides` de `pnpm-workspace.yaml`), sinon `astro check` plante |
| @astrojs/node / preact       | 11.1.9 / 6.1.1         | 11.1.11 / 6.1.2        | —                                                                                                                          |
| preact                       | 11.1.0                 | 11.2.0                 | —                                                                                                                          |
| nodemailer                   | 10.2.1                 | 10.3.1                 | —                                                                                                                          |
| postgres (postgres.js)       | 3.4.9                  | 4.1.0                  | v4 laisse le serveur typer les paramètres ; connexion déjà en UTC, tous les tests sur base réelle passent                  |
| vitest / playwright / eslint | 5.0.5 / 1.64.1 / 10.13 | 5.1.0 / 1.65.0 / 10.14 | —                                                                                                                          |
| @lhci/cli                    | 0.15.1                 | 0.16.0                 | corrige 6 alertes `pnpm audit` (outil de mesure seulement)                                                                 |
| Mailpit (dev, CI)            | 1.32                   | 1.33                   | —                                                                                                                          |

Laissés volontairement :

- **TypeScript 7.0** : toujours refusé par `astro check` et `typescript-eslint` (attendre 7.1).
- **PostgreSQL 19** : seulement en version de test (19rc1).
- **pnpm 12** : le changement automatique de version ne fonctionne pas sur le poste de développement ; rester en 11.x.

`pnpm audit` : **0 alerte sur les dépendances de production**. Restent 3 alertes sur des outils de développement
non exposés (minimatch via ESLint, esbuild via drizzle-kit, basic-ftp via Lighthouse CI), sans correctif compatible.
