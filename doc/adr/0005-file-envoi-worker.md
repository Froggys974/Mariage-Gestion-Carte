# 0005 — File d'envoi en base et worker séparé

## Contexte

Les faire-part partent par email (SMTP) ou WhatsApp (Cloud API de Meta), parfois par dizaines d'un coup.
Les fournisseurs limitent le débit et peuvent échouer temporairement.

## Décision

- Chaque envoi crée une ligne `send_log` + un `message_job` en base (transaction avec l'action admin).
- Un **worker** séparé (`src/worker/index.ts`, service Docker `worker`) traite la file :
  1 message par `WORKER_SEND_INTERVAL_MS` (1 s par défaut), réessais espacés, état visible dans l'admin.
- Fournisseurs interchangeables (`src/lib/messaging/providers.ts`) : `smtp` / `fake` pour l'email,
  `cloud` / `fake` pour WhatsApp. Webhooks : Brevo (statuts email, secret partagé) et Meta
  (signature `X-Hub-Signature-256` vérifiée).
- Le worker exécute aussi la maintenance horaire (traces anti-abus, sessions et codes expirés, purge RGPD).

## Conséquences

- L'application web ne bloque jamais sur un fournisseur lent.
- Le worker doit tourner en production (`docker compose ps` doit le montrer « Up »).
- L'envoi WhatsApp réel n'a été testé qu'avec le fournisseur simulé : le premier essai réel est à faire
  avec un numéro de test Meta avant les envois.
