# Faire-part de mariage

Site-faire-part de mariage, aux couleurs de La Réunion. **Aucune information du mariage dans le code** :
prénoms, date, lieu et contacts se saisissent dans un **assistant d'installation** au premier lancement
(base vide), puis dans l'onglet « Mariage » de l'espace des mariés.

- **site invité** (mobile d'abord, aussi sur tablette et ordinateur) : intro, faire-part à ouvrir et
  enregistrer, programme de la journée, réponse sur une table 3D, dress code, contact, « Lien perdu ? » ;
- **espace des mariés** (`/admin`) : envoi des faire-part (email, WhatsApp, lien) avec contrôle des adresses
  et alerte en cas d'échec, suivi des réponses, éditeur de carte, programme, plan de table, export traiteur.

| Document                                       | Pour quoi                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md) | **mettre le site en ligne**, pas à pas (hébergement, domaine, emails) |
| [`doc/adr/`](doc/adr/README.md)                | décisions techniques (une fiche par décision)                         |

## Sommaire

1. [Démarrer en développement](#démarrer-en-développement)
2. [Commandes](#commandes)
3. [Mettre en ligne](#mettre-en-ligne)
4. [Organisation du code](#organisation-du-code)
5. [Affichage : écrans pris en charge](#affichage--écrans-pris-en-charge)
6. [Sécurité](#sécurité)
7. [Dépannage](#dépannage)

## Stack

Astro 7 (rendu serveur, adaptateur Node) · TypeScript 6 strict · Preact 11 (îlots admin uniquement) ·
PostgreSQL 18 + Drizzle ORM · postgres.js 4 · Zod 4 · Nodemailer 10 · sharp · pino · Docker Compose + Caddy 2.11 ·
Vitest 5 · Playwright · ESLint 10 + Prettier · pnpm 11 · Node 26 LTS.

## Démarrer en développement

### 1. Installer les outils (une seule fois)

| Outil              | Où le trouver                                            | Vérifier (PowerShell)      |
| ------------------ | -------------------------------------------------------- | -------------------------- |
| **Docker Desktop** | docker.com → _Docker Desktop for Windows_                | `docker --version`         |
| **Node 26 LTS**    | nodejs.org → version « LTS » (Node 24 fonctionne encore) | `node --version` → `v26.…` |
| **pnpm 11**        | `npm install -g pnpm@11`                                 | `pnpm --version` → `11.…`  |
| **Git**            | git-scm.com                                              | `git --version`            |

> Restez sur **pnpm 11** : la version 12 ne bascule pas correctement de version sur ce PC (voir ADR 0009).

### 2. Préparer le projet (une seule fois)

Dans PowerShell, dans le dossier du projet :

```powershell
pnpm install                                   # dépendances
Copy-Item .env.development.example .env        # configuration de développement prête à l'emploi
pnpm e2e:install                               # navigateurs des tests (facultatif, pour pnpm e2e)
```

### 3. Lancer le site

**Docker Desktop doit être démarré** (icône de la baleine dans la barre des tâches, état « Engine running »).

**Façon A — tout dans Docker** (le plus simple) :

```powershell
pnpm docker:dev          # base + migrations + site + worker + Mailpit ; laisser ce terminal ouvert
pnpm docker:seed         # dans un 2e terminal : familles de démonstration, liens affichés à la fin
```

**Façon B — base dans Docker, site sur le PC** (rechargement plus rapide sous Windows) :

```powershell
docker compose up -d db mailpit    # base PostgreSQL + Mailpit
pnpm migrate                       # crée les tables (une fois, puis après chaque nouvelle migration)
pnpm seed                          # familles de démonstration
pnpm dev                           # le site ; Ctrl+C pour l'arrêter
pnpm worker                        # (facultatif, 2e terminal) envoi des emails
```

**Premier lancement (base vide)** : http://localhost:4321/admin → connexion → **assistant d'installation**
(5 étapes). Pour sauter l'assistant avec un mariage fictif (« Camille & Alex ») : `pnpm demo-wedding` (façon B)
ou `docker compose exec app node scripts/run.mjs demo-wedding` (façon A).

Puis ouvrir :

| Adresse                     | Contenu                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| http://localhost:4321       | site invité (sans lien personnel) ; « bientôt » avant l'assistant  |
| http://localhost:4321/i/…   | site d'une famille : liens affichés par `seed`                     |
| http://localhost:4321/admin | espace des mariés : **maries@mariage.test** / **mariage-dev-2026** |
| http://localhost:8025       | Mailpit : tous les emails envoyés en développement                 |
| localhost:5434              | PostgreSQL (`mariage` / `mariage`)                                 |

Paramètres utiles dans l'adresse : `?intro=0` (sans l'intro), `?scene=3` (aller à la table), `?open=1`
(ouvrir le faire-part), `?menu=1`.

Arrêter : `Ctrl+C` puis `pnpm docker:down` (les données restent). Interface web de la base (Adminer) :
`docker compose --profile tools up adminer` puis http://localhost:8080.

## Commandes

| Commande                     | Rôle                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm dev`                   | serveur Astro hors Docker (base nécessaire : `docker compose up -d db`)                             |
| `pnpm build` / `pnpm start`  | build de production / démarrage (`dist/start.mjs`)                                                  |
| `pnpm lint` / `pnpm format`  | ESLint + Prettier (vérifier / corriger)                                                             |
| `pnpm typecheck`             | `astro check` + `tsc --noEmit`                                                                      |
| `pnpm test`                  | tests unitaires                                                                                     |
| `pnpm test:db`               | tests unitaires + intégration sur la base `mariage_test` (conteneur `db`)                           |
| `pnpm e2e`                   | Playwright, 7 profils, sur le build de production (`pnpm build` avant ; `db` et `mailpit` démarrés) |
| `pnpm budget:js [url]`       | poids du JS invité (≤ 60 Ko gzip), serveur de production démarré                                    |
| `pnpm lighthouse`            | Lighthouse CI (`lighthouserc.json`), serveur de production sur le port 4321                         |
| `pnpm compare [cas]`         | captures prototype ↔ site côte à côte                                                               |
| `pnpm db:generate`           | génère une migration SQL après modification de `src/lib/db/schema.ts`                               |
| `pnpm migrate` / `pnpm seed` | migrations / données de démo (hors Docker)                                                          |
| `pnpm create-admin-hash`     | hash argon2id d'un mot de passe admin                                                               |
| `pnpm purge`                 | purge RGPD immédiate (normalement automatique au 19/03/2027)                                        |

**Avant de livrer une modification** : `pnpm lint`, `pnpm typecheck`, `pnpm test:db`, puis `pnpm build` et
`pnpm e2e` (base et Mailpit démarrés). Tout doit être vert.

Raccourcis `make` équivalents dans le [`Makefile`](Makefile) (Linux) ; commandes de production :
`pnpm prod:up`, `prod:logs`, `backup`, `backups:list`, `restore`.

## Mettre en ligne

Tout est décrit pas à pas dans [`doc/CONFIGURATION.md`](doc/CONFIGURATION.md). En résumé :

1. **Hébergement** : un petit serveur Linux, jusqu'à l'effacement des données le 19/03/2027. Choix des mariés :
   **AWS « Free plan »**, serveur `t4g.small` (ARM, 2 Go) à Paris, payé par les crédits offerts (0 €). Alternatives
   payantes : IONOS VPS XS (≈ 10 à 20 € au total) ou OVHcloud VPS-1 (≈ 30 à 40 €).
   Les hébergeurs « gratuits » (Vercel, Netlify, Render) ne conviennent pas : pas de base durable, pas de
   dossier pour la photo, pas de processus d'envoi.
2. **Nom de domaine** : un enregistrement DNS **A** vers l'adresse IP du serveur.
3. **Serveur** : clé SSH, pare-feu, mises à jour automatiques, Docker (un bloc à copier-coller).
4. **Projet** : envoyé une première fois avec `git archive` (jamais les secrets), configuré dans `.env`, démarré par
   `docker compose up -d --build`. Caddy obtient seul le certificat HTTPS.
5. **Mises à jour** : automatiques. Un push sur `main` du dépôt GitHub privé lance la CI ; si elle est verte, le
   workflow `Déploiement` envoie le code au serveur par SSH (clé limitée au script `mariage-deploy`) et vérifie
   le site. Les secrets restent dans `.env` sur le serveur (ADR 0012).
6. **Emails** : Brevo (gratuit jusqu'à 300 emails par jour), domaine vérifié (SPF/DKIM).

Au premier lancement, l'assistant d'installation de l'espace des mariés demande les informations du mariage.

## Organisation du code

```
src/
  content/fr.ts         tous les textes visibles (les nouveaux textes sont marqués « NOUVEAU »)
  features/
    invitation/         coque du site invité : scènes, navigation, intro, particules
    card/               faire-part (enveloppe, PNG), éditeur de carte, photo
    programme/          programme de la journée (scène invitée, onglet admin)
    wedding/            infos du mariage en base : assistant d'installation, onglet « Mariage », libellés
    rsvp/               table 3D, brouillon/envoi/déclin, lien perdu, /rsvp public
    admin/              invitations, CSV, traiteur, KPI, purge RGPD
    seating/            plan de table 2D (glisser-déposer, versions, impression)
    messaging/          gabarits, file d'envoi, logique du worker, causes d'échec lisibles
  lib/                  env (Zod), db (Drizzle), auth, sécurité/CSP, limites, stockage, logs, téléphone, email
  pages/                routes Astro (pages + API)
  middleware.ts         en-têtes de sécurité, CSP à nonce, contrôle d'origine, journal des requêtes
  server/start.ts       point d'entrée de production (valide la configuration)
  worker/index.ts       worker : envois + maintenance + purge
drizzle/                migrations SQL
docker/                 Caddyfile, sauvegarde/restauration, init de la base de dev
e2e/                    scénarios Playwright
scripts/                maintenance (migrate, seed, hash, test-mail, purge, budget, compare)
doc/                    design, ADR, configuration, avancement
```

Conventions : un dossier par fonctionnalité (`*.service.ts` côté serveur, `client/` pour le navigateur,
`islands/` pour Preact, `components/` pour Astro) ; tests à côté du code (`*.test.ts`, `*.int.test.ts`
pour ceux qui utilisent la base) ; aucun texte en dur hors de `src/content/fr.ts` ; aucun style en ligne
(CSP) : les valeurs dynamiques passent par le CSSOM.

## Affichage : écrans pris en charge

Vérifié sous Chrome et Safari (WebKit), de 320 px à 1920 px de large :

| Écran                                         | Mise en page                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Téléphone vertical (≥ 390 × 844)              | maquette d'origine, tout tient sans défiler                                                     |
| Petit téléphone (320 à 375 px, ≤ 760 px haut) | espacements resserrés, enveloppe et table réduites ; une scène trop longue défile sous un fondu |
| Téléphone horizontal (≤ 500 px de haut)       | scènes sur deux colonnes (noms / informations, carte / boutons, table / texte)                  |
| Ordinateur portable peu haut (≤ 760 px)       | faire-part et table sur deux colonnes                                                           |
| Tablette, grand écran                         | maquette d'origine centrée                                                                      |

Mécanismes : l'enveloppe est dimensionnée en unités de conteneur (`cqw`, voir `card.css`) et garde ses
proportions ; la table 3D (340 × 370 px) est mise à l'échelle par `table3d.ts` (`fitScale`) pour tenir
dans la place laissée par la scène ; le bas d'écran porte un fondu opaque pour qu'aucun texte ne passe
sous « 0X · Scène / Glissez ».

## Sécurité

- mots de passe admin en **argon2id**, sessions en base (cookie `HttpOnly`, `Secure`, `SameSite=Lax`),
  jeton **CSRF** sur toutes les actions admin, contrôle d'**origine** sur toute requête qui modifie ;
- **CSP stricte** à nonce, en-têtes de sécurité (HSTS, `nosniff`, `frame-ancestors 'none'`…), `noindex` ;
- liens personnels de **128 bits** aléatoires ; « Lien perdu ? » et `/rsvp` répondent pareil que le nom existe
  ou non ; limites anti-abus en base (connexion : 5 essais / 15 min ; codes : 5 essais) ;
- entrées validées par **Zod** (adresses email : faute de frappe et domaine vérifiés), taille des corps bornée, images ré-encodées par sharp, chemins de fichiers
  verrouillés ; protection contre l'injection de formules dans les exports CSV ;
- journaux sans données personnelles (tokens et secrets masqués, IP tronquées) ; purge RGPD automatique ;
- `pnpm audit --prod` : 0 alerte (novembre 2026).

## Dépannage

| Symptôme                                                                          | Solution                                                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `docker` répond « 500 Internal Server Error » alors que Docker Desktop est ouvert | quitter Docker Desktop (clic droit sur la baleine → _Quit_), puis dans PowerShell `wsl --shutdown`, puis relancer Docker Desktop |
| La première page met une minute à s'afficher (façon A)                            | normal : compilation initiale à travers le dossier monté dans Docker ; les suivantes sont rapides                                |
| `port 5434 is already allocated` / `4321 already in use`                          | un autre conteneur ou `pnpm dev` tourne déjà : `pnpm docker:down`, ou fermer l'autre terminal                                    |
| Erreur « Configuration invalide (.env) »                                          | la variable fautive est nommée dans le message ; repartir de `.env.development.example`                                          |
| Connexion admin : « Trop de tentatives »                                          | attendre 15 minutes (ou vider la table `rate_limit_hit` en développement)                                                        |
| Après une mise à jour des dépendances, le site Docker ne démarre plus             | `pnpm docker:down` puis `pnpm docker:dev` : le service `migrate` resynchronise `node_modules`                                    |

Un dossier `.pnpm-store/` à la racine du projet est un reste d'une ancienne configuration : il est ignoré et
peut être supprimé sans risque.

## Intégration continue

`.github/workflows/ci.yml` : lint, types, tests (avec PostgreSQL 18), build, e2e (7 profils), budget JS et
Lighthouse, à chaque push sur `main` et à chaque pull request. `.github/workflows/deploy.yml` : mise en ligne
automatique quand la CI est verte sur `main` (voir `doc/CONFIGURATION.md` § 8).
