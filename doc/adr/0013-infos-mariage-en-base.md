# 0013 — Informations du mariage en base, assistant d'installation

## Contexte

Les prénoms, la date, le lieu, les contacts et l'email du responsable des données étaient écrits dans
`src/content/fr.ts` (et une image des noms dans `public/email/noms.png`). Les mariés veulent :

- un code **sans aucune information personnelle** (pouvoir le montrer, le réutiliser) ;
- qu'une **base neuve** pose les questions principales au premier lancement.

Les secrets restent dans `.env` (serveur) ; `.env` ne convient pas au contenu : le modifier demande un accès
au serveur et un redémarrage.

## Décision

1. Table **`wedding`** (ligne unique, migration `0003_wedding.sql`) : prénoms et noms des deux mariés, date,
   heures de cérémonie et de réception, lieu (nom, ville, région), lieu de réception, email et téléphone de
   contact (+ libellé), email RGPD. **Absente = site non configuré.**
2. `src/features/wedding/wedding.ts` (sans import Node) dérive les **libellés** (`WeddingLabels`) : noms
   insécables, monogramme (« Marie-Ange » → « M‑A »), dates (« Samedi 20 février 2027 », « 20 · 02 · 2027 »,
   « 1er »), heures (« 14h30 »), itinéraire, nom du fichier de la carte. Les textes de `fr.ts` qui en
   dépendent deviennent des fonctions `(w) => …` ; `fr.ts` ne garde que des textes génériques.
3. **Assistant d'installation** (`/admin/setup`, îlot `WeddingForm`, 5 étapes + récapitulatif), derrière la
   connexion admin et le jeton CSRF ; `POST /api/admin/wedding` ne fonctionne qu'une fois (409 ensuite). Il
   prépare dans la même transaction : carte, programme (cérémonie, puis réception), date limite (proposée
   18 jours avant), effacement (3 mois après), invitation « Les mariés » ; puis le navigateur dessine et
   envoie l'image des noms pour les emails (sans elle, les emails écrivent les noms en texte).
4. **Onglet « Mariage »** (`PUT /api/admin/wedding`) : mêmes champs ; met aussi à jour « Les mariés ». La
   carte, le programme et les dates gardent leurs propres onglets (pas d'écrasement involontaire).
5. Avant l'installation : les pages invitées (`/`, `/i/…`, `/rsvp`, `/confidentialite`) affichent
   `/bientot` ; `/admin` renvoie vers l'assistant ; le worker refuse d'envoyer un email (erreur non
   réessayée).
6. Tests et démo : mariage **fictif** « Camille & Alex » (`src/features/wedding/demo.ts`,
   `pnpm demo-wedding`), utilisé par la base de test et les e2e.

## Conséquences

- Les bases existantes passent par l'assistant après la migration (leurs invitations sont conservées ; la
  carte et le programme sont réécrits par l'installation, la photo est gardée).
- Le modèle de message WhatsApp à faire valider par Meta reste un texte saisi chez Meta ; le texte proposé
  (`fr.whatsapp.templateBody(w)`) est généré à partir des infos.
- Restent hors du code mais dans le dépôt : les maquettes `doc/design/` et la documentation de suivi
  (`doc/PROGRESS.md`), qui citent le mariage d'origine.
