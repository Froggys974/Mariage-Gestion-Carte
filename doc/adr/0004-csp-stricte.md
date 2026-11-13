# 0004 — Politique de sécurité du contenu (CSP) stricte

## Contexte

Le site affiche des noms saisis par les invités et par l'admin. Une injection de script serait grave
(liens personnels, données de santé).

## Décision

- En production, `src/middleware.ts` ajoute une CSP `default-src 'self'` avec **nonce** par requête,
  plus `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `noindex`.
- **Aucun CSS ni JS en ligne** : `build.inlineStylesheets: 'never'` et `vite.build.assetsInlineLimit: 0`.
  Seule exception : `style-src-attr 'unsafe-inline'`, pour les attributs `style=""` de positionnement
  rendus côté serveur par les îlots Preact (plan de table) ; elle n'autorise ni balise `<style>` ni script.
- `security.checkOrigin` d'Astro est désactivé au profit du contrôle d'origine maison (le seul qui
  fonctionne correctement derrière le reverse proxy HTTPS).

## Conséquences

- Tout nouveau script ou style doit passer par un fichier (pas d'attribut `style=` côté serveur ni
  de `<script>` inline sans nonce). Les tests e2e tournent sur le build de production : une violation
  de CSP casse les scénarios.
