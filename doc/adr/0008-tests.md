# 0008 — Stratégie de tests

## Décision

| Niveau       | Outil                    | Commande                            | Ce qui est couvert                                                       |
| ------------ | ------------------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| Unitaires    | Vitest 5                 | `pnpm test`                         | logique pure : navigation, table 3D, CSV, téléphone, limites, CSP, plan… |
| Intégration  | Vitest + PostgreSQL réel | `pnpm test:db`                      | service de réponse (brouillon, envoi, déclin, remplacement sans doublon) |
| Bout en bout | Playwright, 7 profils    | `pnpm e2e`                          | build de **production** (CSP active), worker et Mailpit réels            |
| Performance  | script + Lighthouse CI   | `pnpm budget:js`, `pnpm lighthouse` | ≤ 60 Ko de JS invité, LCP < 2,5 s sur mobile                             |

Profils e2e : iPhone SE, iPhone 15, Pixel 7, Galaxy S9+, iPad Mini, iPad Pro paysage, ordinateur 1440 px.

## Règles

- Chaque test e2e crée ses propres données (invitation, numéro de téléphone) et se présente avec sa
  propre IP (`X-Forwarded-For`, `TRUST_PROXY=true`) : les tests sont indépendants et parallélisables,
  et les limites anti-abus restent actives.
- La CI GitHub (`.github/workflows/ci.yml`) enchaîne qualité → build → e2e → budget JS → Lighthouse,
  avec PostgreSQL 18 et Mailpit en services.
