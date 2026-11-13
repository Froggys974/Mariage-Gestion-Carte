# 0003 — Authentification de l'espace des mariés

## Contexte

Deux utilisateurs au plus (les mariés). Pas besoin d'inscription ni de fournisseur d'identité externe,
mais l'admin donne accès à des données personnelles (contacts, allergies).

## Décision

- Comptes définis dans la configuration : `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (et `ADMIN2_*` facultatif).
  Le hash est **argon2id** (`@node-rs/argon2`), généré par `pnpm create-admin-hash` ; aucun mot de passe en clair.
- **Sessions en base** (`admin_session`), cookie `httpOnly`, `SameSite=Lax`, `Secure` en HTTPS, durée 7 jours.
- Formulaire de connexion protégé par un **jeton CSRF** (double cookie) ; les routes d'admin vérifient
  l'en-tête `Origin` dans `src/middleware.ts` (compatible avec Caddy en reverse proxy).
- **5 tentatives / 15 min / IP** (`rate_limit_hit` en base, clés HMAC sans IP en clair).

## Conséquences

- Changer de mot de passe = générer un nouveau hash et redémarrer `app`.
- Derrière Caddy, `TRUST_PROXY=true` : l'IP est la première adresse de `X-Forwarded-For`
  (Caddy remplace cet en-tête, un visiteur ne peut pas le falsifier).
