# 0011 — Programme de la journée, contrôle des adresses, envois en échec

## Contexte

Demandes des mariés du 08/11/2026 :

- afficher le **programme de la journée** (accueil, cérémonie, réception…), modifiable par eux ;
- **vérifier les adresses email** saisies ;
- être **prévenus dans leur espace** quand un email ou un WhatsApp n'arrive pas.

## Décision

1. **Programme** : une colonne `card_settings.programme` (`jsonb`, liste de `{ time, title, place, note }`),
   à côté de la carte qu'il complète (ligne unique, pas de jointure). `null` = programme par défaut de
   `fr.programme.defaults`. 1 à 12 moments, longueurs bornées (`src/features/programme/programme.ts`),
   validés par Zod côté serveur. Pas de contrôle de version : un seul formulaire, enregistré d'un bloc.
   - Site invité : nouvelle **scène 2 « Le programme »** entre le faire-part et la table (choix des mariés).
     Les scènes suivantes sont décalées (table 3, dress code 4, contact 5) ; la table 3D lit son rang dans
     le HTML (`data-scene`) au lieu d'une constante.
   - Admin : onglet **Programme** (`ProgrammeEditor`), aperçu en direct, monter / descendre / retirer.
2. **Adresse email** (`src/lib/email-check.ts`), à la création, à la modification (si l'adresse change) et à
   l'import CSV :
   - faute de frappe probable dans un fournisseur courant (distance d'édition ≤ 1, ou ≤ 2 pour un domaine
     long ; quelques fautes connues comme `gmail.fr`) → « Vouliez-vous dire … ? » avec **Corriger** ou
     **Garder telle quelle** (`confirmEmail`). À l'import CSV, la ligne est refusée avec la suggestion ;
   - domaine sans email : DNS MX, sinon A / AAAA (RFC 5321), « null MX » (RFC 7505) → refus. Un doute (DNS en
     panne, délai de 4 s dépassé) ne bloque jamais. Les domaines de test (`.test`, `example.com`…) ne sont
     pas interrogés.
3. **Envois en échec** :
   - SMTP : un refus définitif (code 5xx) n'est plus réessayé 6 fois ; le message garde le code
     (`EENVELOPE 550 5.1.1 …`) ;
   - `classifySendError` traduit l'erreur (SMTP, évènement Brevo, code WhatsApp de Meta) en une cause lisible
     (adresse inexistante, boîte pleine, numéro sans WhatsApp, compte en mode test, service mal configuré…) ;
   - onglet Invitations : **encadré** listant les invitations dont le dernier envoi a échoué, avec la cause et
     « Ouvrir la fiche » ; filtre « Envoi en échec » ; cause et détail technique dans l'historique. La liste se
     rafraîchit toutes les 15 s, donc un échec signalé plus tard par webhook apparaît seul.

## Conséquences

- Migration `drizzle/0002_programme.sql` (ajout d'une colonne, sans perte de données).
- Les adresses inexistantes chez un fournisseur qui accepte tout puis rejette plus tard (Brevo) ne sont
  connues que par le **webhook** : il devient fortement conseillé (`doc/CONFIGURATION.md`, 6.1).
- L'heure d'accueil du programme par défaut (14h30) est un exemple à confirmer par les mariés.
