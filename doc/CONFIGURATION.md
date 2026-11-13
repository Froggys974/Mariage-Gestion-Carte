# Mettre le site en ligne — guide pas à pas

Ce guide est écrit pour les mariés : chaque étape dit **quoi taper** et **quoi copier**.
Comptez environ 1 h 30 la première fois (dont l'attente de la commande du serveur et du DNS). Les commandes sont à taper dans un terminal sur le **serveur**
(sauf mention « sur votre PC »).

---

## 0. Avant de commencer

**Aucune information du mariage n'est écrite dans le code** : prénoms, date, heures, lieu, contacts et email
pour les données personnelles se saisissent dans l'**assistant d'installation**, à la première connexion à
l'espace des mariés (étape 5), puis se modifient dans l'onglet **Mariage**. Tant qu'il n'est pas rempli, les
invités voient « Le faire‑part arrive bientôt ».

Préparez donc : les prénoms et noms des mariés, la date et les heures (cérémonie, réception), le lieu (et
celui de la réception s'il est différent), un email de contact (et un téléphone si vous voulez), l'email pour
les questions sur les données personnelles, et la date limite des réponses.

À relire si vous le souhaitez : les textes marqués `// NOUVEAU` dans `src/content/fr.ts` (textes génériques
écrits pour la production).

---

## 1. Choisir l'hébergement

Le site a besoin d'un **petit serveur Linux** (un « VPS ») : il y fait tourner le site, la base de données,
l'envoi des emails et le certificat HTTPS, déjà tout prêts dans Docker. Un hébergement « gratuit » de type
Vercel, Netlify ou Render ne convient pas : il n'a ni base de données durable, ni dossier pour la photo de la
carte, ni processus d'envoi permanent, et il « s'endort » (première page lente).

Pour 80 invités, le site reçoit au plus quelques centaines de visites par jour : un petit serveur suffit
largement. Le choix se fait surtout sur le prix et le confort.

| Offre (prix relevés le 12/11/2026)                                   | Prix                                                                                        | Pour                                                                                                                                                                                      | Contre                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **AWS « Free plan »** (t4g.small : 2 vCPU, 2 Go, Paris) — **choisi** | **0 €** : crédits offerts (100 à 200 $) pendant 6 mois au plus                              | un compte ouvert en novembre 2026 reste gratuit jusqu'en mai 2027, après l'effacement des données ; serveur à Paris, arrêt automatique (jamais de facture) quand les crédits sont épuisés | console en partie en anglais, carte bancaire demandée à l'inscription, le compte gratuit se ferme seul au bout de 6 mois                       |
| **OVHcloud VPS-1** (2 vCores, 4 Go, 40 Go) — confortable             | ≈ 7,80 € TTC/mois sans engagement (≈ 4,60 € avec 12 mois)                                   | société française, serveur en France, interface et support en français, sauvegarde quotidienne incluse                                                                                    | le meilleur prix demande 12 mois d'engagement                                                                                                  |
| **IONOS VPS XS** (1 vCore, 1 Go, 10 Go) — le moins cher              | ≈ 1,20 € TTC/mois ; des frais de mise en service (≈ 12 €) peuvent s'ajouter sans engagement | prix très bas, serveurs en Europe, interface en français                                                                                                                                  | 1 Go de mémoire : il faut ajouter une mémoire de secours (étape 2.5), la mise à jour du site est plus lente ; vérifiez la durée d'engagement   |
| Hetzner Cloud CX23 (2 vCPU, 4 Go, 40 Go)                             | ≈ 6 € HT/mois (≈ 7,20 € TTC), facturé à l'heure                                             | supprimable à tout moment, interface simple                                                                                                                                               | interface en anglais, serveurs en Allemagne ou en Finlande, disponibilité parfois limitée depuis juin 2026                                     |
| Oracle Cloud « Always Free » (région Marseille)                      | gratuit                                                                                     | serveur ARM puissant                                                                                                                                                                      | inscription avec carte bancaire souvent refusée, serveurs souvent « indisponibles », et un serveur peu utilisé peut être **repris** par Oracle |

Les prix changent souvent (plusieurs hausses en 2026) : vérifiez-les au moment de commander.

**Choix des mariés (12/11/2026) : AWS « Free plan »**, étape 2.2. Le site n'est utile que jusqu'au
**19/03/2027** (effacement automatique des données) : un serveur `t4g.small` à Paris coûte ≈ 19 $ par mois
(adresse IP et disque compris), soit ≈ 85 $ sur la période, payés par les crédits offerts. Alternatives
payantes : **IONOS VPS XS** (≈ 10 à 20 € au total) ou **OVHcloud VPS-1** (≈ 30 à 40 €), étape 2.2 bis.

Les emails passent par Brevo, gratuit jusqu'à 300 emails par jour. Le nom de domaine, vous l'avez déjà.

Performances : le site est léger (≈ 20 Ko de JavaScript, images optimisées, compression) ; un serveur en France
répond vite depuis La Réunion (≈ 0,2 s d'aller-retour) et 4 Go de mémoire laissent une large marge.

## 2. Créer le serveur

### 2.1 Une clé SSH sur votre PC (une seule fois)

La clé remplace le mot de passe pour se connecter au serveur : c'est plus sûr. **Sur votre PC**, dans PowerShell :

```powershell
ssh-keygen -t ed25519 -C "serveur mariage"
```

Appuyez trois fois sur Entrée (emplacement par défaut, phrase secrète facultative). Puis affichez la clé
**publique**, celle à donner à l'hébergeur :

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

Copiez toute la ligne (elle commence par `ssh-ed25519`). Ne donnez **jamais** le fichier `id_ed25519`
(sans `.pub`) : c'est la clé privée, elle reste sur votre PC.

### 2.2 Créer le serveur chez AWS (gratuit)

Comptez 30 minutes. La console AWS est en français (langue réglable en bas de page) ; les noms anglais sont
donnés entre parenthèses.

**a. Le compte**

1. Sur **aws.amazon.com** → _Créer un compte AWS_ : votre email, un nom de compte (`mariage`), un mot de passe.
2. Choisissez le **Plan gratuit** (_Free plan_), **pas** le plan payant : avec le plan gratuit, AWS arrête les
   services quand les crédits sont épuisés au lieu de facturer.
3. Carte bancaire (simple vérification, rien n'est prélevé avec le plan gratuit), puis code reçu par SMS.
4. **Protégez le compte** : en haut à droite, votre nom → _Informations d'identification de sécurité_
   (_Security credentials_) → _Attribuer un dispositif MFA_ → « Application d'authentification » (Google
   Authenticator, Microsoft Authenticator…). Sans cette étape, quiconque devine le mot de passe a la main
   sur le serveur.
5. **Alerte de budget** : barre de recherche → **Budgets** → _Créer un budget_ → modèle « Budget à dépense
   nulle » (_Zero spend budget_) → votre email. Vous serez prévenus au moindre centime. Les crédits restants
   se voient dans _Facturation_ → _Crédits_.

**b. La région : Paris**

En haut à droite, à côté de votre nom, choisissez **Europe (Paris) eu-west-3**. Tout ce qui suit se fait dans
cette région (si un serveur « disparaît », vérifiez d'abord la région affichée).

**c. Votre clé SSH**

Barre de recherche → **EC2** → menu de gauche _Réseau et sécurité_ → **Paires de clés** (_Key pairs_) →
_Actions_ → **Importer une paire de clés** → nom `mariage` → collez la ligne copiée en 2.1 → _Importer_.

**d. Le serveur**

EC2 → **Lancer une instance** (_Launch instance_) :

| Champ                                    | Valeur                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Nom                                      | `mariage`                                                                                                                      |
| Images (AMI)                             | **Ubuntu** → _Ubuntu Server 24.04 LTS_, architecture **64 bits (Arm)**                                                         |
| Type d'instance                          | **t4g.small** (mention « Éligible à l'offre gratuite »)                                                                        |
| Paire de clés                            | `mariage`                                                                                                                      |
| Paramètres réseau → _Modifier_           | « Créer un groupe de sécurité », nom `mariage-web` ; « Attribuer automatiquement l'adresse IP publique » : Activer             |
| Règles du pare-feu (_Ajouter une règle_) | SSH, TCP 22, source `0.0.0.0/0` · HTTP, TCP 80, `0.0.0.0/0` · HTTPS, TCP 443, `0.0.0.0/0` · UDP personnalisé, 443, `0.0.0.0/0` |
| Configurer le stockage                   | **20** Gio, **gp3**                                                                                                            |

Puis _Lancer l'instance_. SSH reste ouvert à tous, mais seule votre clé permet d'entrer (étape 2.4 : mot de
passe interdit, fail2ban). Si `t4g.small` n'apparaît pas comme éligible, prenez **t3.small** avec une image
« 64 bits (x86) » : un peu plus chère (≈ 23 $ par mois), elle reste couverte par les crédits si vous faites les
« activités » proposées par AWS (lancer une instance, créer un budget… chacune rapporte 20 $).

**e. Une adresse IP fixe**

Sans elle, l'adresse change à chaque redémarrage du serveur et le nom de domaine ne pointe plus dessus.
EC2 → _Réseau et sécurité_ → **Adresses IP Elastic** → _Allouer l'adresse IP Elastic_ → _Allouer_ →
sélectionnez-la → _Actions_ → **Associer l'adresse IP Elastic** → instance `mariage` → _Associer_.
Notez cette adresse (quatre nombres, par exemple `15.237.12.34`) : c'est l'**ADRESSE_IP** de la suite.
L'utilisateur est **`ubuntu`**.

Faites ensuite les étapes 2.3, 2.4 **et 2.5** (la mémoire de secours est conseillée avec 2 Go).

### 2.2 bis Autre hébergeur : OVHcloud, IONOS, Hetzner

**OVHcloud VPS-1**

1. Sur **ovhcloud.com** → _Bare Metal & VPS_ → **VPS** → offre **VPS-1** → _Commander_.
2. **Localisation** : une ville en **France** (Gravelines, Strasbourg ou Roubaix).
3. **Système** : **Ubuntu 24.04** (sans application préinstallée).
4. **Clé SSH** : collez la ligne copiée en 2.1.
5. **Durée** : sans engagement (mensuel), sauf si vous préférez payer 12 mois d'un coup.
6. Payez. Quelques minutes plus tard, un email donne l'**adresse IP** du serveur (quatre nombres, par exemple
   `51.38.12.34`) et l'utilisateur : **`ubuntu`**.

> Chez **IONOS** : _Serveurs & Cloud_ → **VPS** → **VPS Linux XS** → image **Ubuntu 24.04** → ajoutez votre clé
> SSH (2.1) si le formulaire le propose. L'utilisateur est **`root`** : dans la suite, remplacez `ubuntu@` par
> `root@` et ignorez `sudo -i`. Faites ensuite l'étape 2.5 (mémoire de secours).
>
> Chez **Hetzner** : _Add Server_ → emplacement Nuremberg ou Falkenstein → image Ubuntu 24.04 → type
> « Shared vCPU, x86 » avec 4 Go → collez la clé SSH → _Create_. L'utilisateur est alors **`root`** :
> dans la suite, remplacez `ubuntu@` par `root@` et ignorez `sudo -i`.

### 2.3 Faire pointer le nom de domaine vers le serveur

Chez le fournisseur de votre nom de domaine (OVHcloud, Gandi, IONOS…), dans la **zone DNS** :

1. **Supprimez** les enregistrements **A** et **AAAA** existants pour le nom choisi (souvent une page
   « parking ») : sinon le certificat HTTPS ne peut pas être délivré.
2. **Ajoutez** un enregistrement **A** : sous-domaine vide (`@`) pour `mondomaine.fr`, ou `mariage` pour
   `mariage.mondomaine.fr` ; cible = l'**adresse IP** du serveur.
3. Attendez quelques minutes (parfois quelques heures). Pour vérifier, sur votre PC :
   `Resolve-DnsName mondomaine.fr` doit afficher l'adresse IP du serveur.

### 2.4 Se connecter et sécuriser le serveur

**Sur votre PC**, dans PowerShell :

```powershell
ssh ubuntu@ADRESSE_IP
```

La première fois, répondez `yes`. Vous êtes sur le serveur. Passez administrateur, puis copiez-collez ce bloc
entier : mises à jour, mises à jour de sécurité automatiques, pare-feu, blocage des essais de mot de passe
répétés, Docker.

```bash
sudo -i
apt update && apt -y full-upgrade
apt -y install unattended-upgrades ufw fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
curl -fsSL https://get.docker.com | sh
docker --version
```

La dernière ligne doit afficher « Docker version 2x… ». Puis **interdisez la connexion par mot de passe**
(seule votre clé SSH ouvrira le serveur) et redémarrez :

```bash
echo "PasswordAuthentication no" > /etc/ssh/sshd_config.d/00-mariage.conf
systemctl reload ssh
reboot
```

Attendez une minute et reconnectez-vous (`ssh ubuntu@ADRESSE_IP`). **À chaque connexion**, commencez par
`sudo -i`, puis `cd /opt/mariage` une fois le projet installé.

### 2.5 Petit serveur (1 ou 2 Go de mémoire) : mémoire de secours

Le site tourne avec environ 400 Mo, mais sa **construction** (étape 5 et chaque mise à jour) en demande
davantage. Sur un serveur de 1 ou 2 Go, ajoutez 2 Go de mémoire de secours (« swap ») sur le disque, une seule
fois :

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

La ligne « Swap » doit afficher 2,0Gi. Sur un disque de 10 Go, faites aussi le ménage après chaque mise à
jour : `docker image prune -f && docker builder prune -f`.

## 3. Envoyer le projet sur le serveur

**Sur votre PC**, dans PowerShell, dans le dossier du projet. Ces commandes emballent exactement les fichiers du
projet, sans vos secrets (`.env`) ni les dossiers de travail (`node_modules`, `dist`…) :

```powershell
git add -A
git archive --format=tar.gz -o ..\mariage.tgz (git write-tree)
scp ..\mariage.tgz ubuntu@ADRESSE_IP:/tmp/
```

**Sur le serveur** (après `sudo -i`) :

```bash
mkdir -p /opt/mariage && cd /opt/mariage
tar -xzf /tmp/mariage.tgz
```

> Toutes les commandes suivantes se tapent **dans `/opt/mariage`**, en administrateur.
> Cet envoi manuel ne sert que la première fois : ensuite, les mises à jour passent par GitHub (étape 8).

## 4. Créer le fichier de configuration `.env`

```bash
cp .env.example .env
nano .env                 # éditeur de texte : Ctrl+O pour enregistrer, Ctrl+X pour quitter
```

Pour fabriquer les secrets aléatoires demandés ci-dessous :

```bash
openssl rand -base64 32   # pour SESSION_SECRET
openssl rand -hex 24      # pour POSTGRES_PASSWORD (lettres et chiffres uniquement)
```

### 4.1 Mot de passe de l'espace des mariés

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps app node scripts/run.mjs create-admin-hash
```

Tapez le mot de passe choisi (**12 caractères minimum**). La commande affiche une ligne
`ADMIN_PASSWORD_HASH='$argon2id$…'` : copiez-la **telle quelle, guillemets simples compris**, dans `.env`.
Pour un second compte (l'autre marié·e), recommencez et remplissez `ADMIN2_EMAIL` / `ADMIN2_PASSWORD_HASH`.

### 4.2 Toutes les variables

**Obligatoires** :

| Variable              | Valeur à mettre                                          | Exemple                                          |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`            | `production`                                             | `production`                                     |
| `COMPOSE_FILE`        | `docker-compose.prod.yml` (les commandes visent la prod) | `docker-compose.prod.yml`                        |
| `DOMAIN`              | votre domaine, sans `https://`                           | `mariage-rc-gn.re`                               |
| `PUBLIC_URL`          | `https://` + le domaine, sans `/` à la fin               | `https://mariage-rc-gn.re`                       |
| `ACME_EMAIL`          | votre email (alertes du certificat HTTPS)                | `guy.noel@exemple.re`                            |
| `SESSION_SECRET`      | résultat de `openssl rand -base64 32`                    | `q8V…` (au moins 32 caractères)                  |
| `POSTGRES_USER`       | `mariage`                                                | `mariage`                                        |
| `POSTGRES_PASSWORD`   | résultat de `openssl rand -hex 24`                       | `3f9a…`                                          |
| `POSTGRES_DB`         | `mariage`                                                | `mariage`                                        |
| `ADMIN_EMAIL`         | email de connexion à l'espace des mariés                 | `marie@exemple.re`                               |
| `ADMIN_PASSWORD_HASH` | ligne produite à l'étape 4.1                             | `'$argon2id$v=19$…'`                             |
| `EMAIL_PROVIDER`      | `smtp`                                                   | `smtp`                                           |
| `SMTP_HOST`           | serveur SMTP du fournisseur                              | `smtp-relay.brevo.com`                           |
| `SMTP_PORT`           | `587` (ou `465`)                                         | `587`                                            |
| `SMTP_USER`           | identifiant SMTP du fournisseur                          | `8a1b2c001@smtp-brevo.com`                       |
| `SMTP_PASS`           | clé SMTP du fournisseur                                  | `xsmtpsib-…`                                     |
| `MAIL_FROM`           | expéditeur affiché, adresse du domaine vérifié           | `"Marie & Paul <faire-part@mariage.exemple.re>"` |

**Facultatives** (laisser la valeur de `.env.example` si vous ne savez pas) :

| Variable                               | Rôle                                                | Par défaut / exemple       |
| -------------------------------------- | --------------------------------------------------- | -------------------------- |
| `ADMIN2_EMAIL`, `ADMIN2_PASSWORD_HASH` | second compte admin (les deux ensemble, ou aucun)   | vide                       |
| `SMTP_SECURE`                          | `true` seulement avec le port 465                   | vide                       |
| `MAIL_REPLY_TO`                        | adresse qui reçoit les réponses aux emails          | vide                       |
| `EMAIL_WEBHOOK_SECRET`                 | secret du suivi des emails Brevo (voir 6.1)         | vide                       |
| `WHATSAPP_PROVIDER`                    | `cloud` pour envoyer vraiment, `fake` sinon         | `fake`                     |
| `WHATSAPP_PHONE_NUMBER_ID`             | identifiant du numéro (Meta)                        | —                          |
| `WHATSAPP_TOKEN`                       | token permanent (Meta)                              | —                          |
| `WHATSAPP_APP_SECRET`                  | clé secrète de l'app Meta (vérifie les webhooks)    | —                          |
| `WHATSAPP_VERIFY_TOKEN`                | mot de votre choix, recopié chez Meta               | —                          |
| `WHATSAPP_TEMPLATE_NAME`               | modèle du faire-part ({{1}} = prénom, {{2}} = lien) | `faire_part_invitation`    |
| `WHATSAPP_TEMPLATE_LANG`               | langue du modèle                                    | `fr`                       |
| `WHATSAPP_OTP_TEMPLATE_NAME`           | modèle « Authentification » du code à 6 chiffres    | `code_verification`        |
| `WHATSAPP_API_VERSION`                 | version de l'API Meta                               | `v26.0`                    |
| `TRUST_PROXY`                          | `true` (le site est derrière Caddy)                 | `true`                     |
| `LOG_LEVEL`                            | détail des journaux : `warn`, `info`, `debug`       | `info`                     |
| `TZ`                                   | fuseau horaire                                      | `Indian/Reunion`           |
| `WORKER_SEND_INTERVAL_MS`              | délai entre deux envois groupés (ms)                | `1000`                     |
| `BACKUP_KEEP`                          | nombre de sauvegardes gardées                       | `14`                       |
| `BACKUP_CRON`                          | heure de la sauvegarde (format cron)                | `0 3 * * *` (3 h du matin) |

Ignorées en production (fixées par `docker-compose.prod.yml`) : `DATABASE_URL`, `UPLOAD_DIR`, `HOST`, `PORT`.

## 5. Démarrer

```bash
docker compose up -d --build
docker compose ps
```

Au bout de 1 à 3 minutes, `app`, `worker`, `db`, `caddy` et `backup` doivent être « Up » (ou « healthy »),
et `migrate` « Exited (0) ». Vérifications :

1. Ouvrez `https://VOTRE_DOMAINE/api/health` : la page doit afficher `{"ok":true…}`.
2. Ouvrez `https://VOTRE_DOMAINE/admin` et connectez-vous : la première fois, l'**assistant d'installation**
   s'ouvre (5 étapes : les mariés, le jour J, le lieu, pour vous joindre, les réponses). À la fin,
   « Créer le faire‑part » prépare la carte, le programme et les dates ; le site des invités est en ligne.
3. Email de test :
   `docker compose exec app node scripts/run.mjs test-mail votre-adresse@exemple.re`
   → l'email doit arriver (regardez aussi les spams).

En cas d'erreur : `docker compose logs app --tail=100` affiche le message (une variable manquante est
nommée en clair, par exemple `SMTP_HOST : obligatoire quand EMAIL_PROVIDER=smtp`).

## 6. Fournisseurs d'envoi

### 6.1 Emails (Brevo)

1. Créez un compte gratuit sur **brevo.com** (300 emails par jour : assez pour 80 invités, relances comprises).
2. Brevo → _Expéditeurs, domaines_ → ajoutez et **vérifiez votre domaine** : Brevo affiche 2 ou 3
   enregistrements DNS (DKIM, SPF, DMARC) à recopier chez le fournisseur de votre nom de domaine, comme en 2.3.
   Sans cette étape, les faire-part risquent d'arriver dans les **spams**.
3. Dans `.env`, `MAIL_FROM` doit utiliser ce domaine (ex. `"Marie & Paul <faire-part@VOTRE_DOMAINE>"`).
4. Brevo → _SMTP & API_ → onglet SMTP : recopiez serveur, port, identifiant et clé dans `.env` (4.2).
5. **Retours d'envoi (fortement conseillé)** : choisissez un secret, mettez-le dans `EMAIL_WEBHOOK_SECRET`,
   puis Brevo → _Webhooks_ → URL : `https://VOTRE_DOMAINE/api/webhooks/email?secret=LE_SECRET`, en cochant
   les évènements _Delivered, Opened, Hard bounce, Soft bounce, Invalid email, Blocked, Spam_.
   Brevo accepte d'abord tous les emails puis signale **plus tard** une adresse qui n'existe pas : sans ce
   réglage, l'espace des mariés ne peut pas vous prévenir de ces échecs.
6. Après toute modification de `.env` : `docker compose up -d`.
7. Envoyez-vous un faire-part depuis l'admin, à votre propre adresse : il doit arriver en boîte de réception,
   et son statut passer à « Délivré » puis « Lu ».

### 6.2 WhatsApp (facultatif)

**Le plus simple, sans rien configurer :** pour un invité sans email, ouvrez sa ligne dans l'admin → ↻ →
**« WhatsApp sans API (wa.me) »**. WhatsApp s'ouvre sur votre téléphone ou votre PC avec le message et le lien
personnel déjà écrits : il ne reste qu'à appuyer sur « Envoyer ». C'est gratuit et suffisant pour quelques
dizaines d'invités.

**L'envoi automatique (API de Meta)** envoie depuis le site, en un clic, même en groupe. Il demande :

- un numéro de téléphone **qui n'est pas déjà utilisé** dans l'application WhatsApp (une puce prépayée suffit) ;
- un compte Meta Business, et un **moyen de paiement** : chaque message de type « Utilité » est facturé
  quelques centimes (voir la page « Pricing » de WhatsApp Business) ;
- tant que le numéro est « de test », seuls 5 numéros déclarés à l'avance peuvent recevoir les messages.

Étapes :

1. developers.facebook.com → créez une app « Business » → ajoutez **WhatsApp**.
2. _Configuration de l'API_ : notez le **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Business Manager → _Utilisateurs système_ → générez un **token permanent** (permission
   `whatsapp_business_messaging`) → `WHATSAPP_TOKEN`.
4. _Paramètres de l'app → Général_ → **Clé secrète** → `WHATSAPP_APP_SECRET`.
5. _Modèles de message_ : créez `faire_part_invitation` (catégorie Utilité, variables {{1}} prénom et
   {{2}} lien) et `code_verification` (catégorie Authentification). Attendez leur approbation.
6. _Webhooks_ : URL `https://VOTRE_DOMAINE/api/webhooks/whatsapp`, jeton de vérification = la valeur de
   `WHATSAPP_VERIFY_TOKEN`, abonnez-vous à `messages`.
7. `WHATSAPP_PROVIDER=cloud`, puis `docker compose up -d`.
8. **Faites un essai** en vous envoyant un faire-part à vous-même depuis l'admin avant tout envoi groupé
   (l'envoi réel n'a jamais été essayé, seulement simulé).

### 6.3 Quand un envoi échoue

- **À la saisie**, l'admin vérifie l'adresse email : faute de frappe probable (« gmial.com » → il propose
  « gmail.com ») ou domaine qui n'existe pas. Le numéro de téléphone est vérifié aussi.
- **Après l'envoi**, si un email ou un WhatsApp n'arrive pas (adresse inexistante, boîte pleine, numéro sans
  WhatsApp, service mal configuré…), un **encadré rouge** apparaît en haut de l'onglet _Invitations_ avec la
  cause en clair et un bouton « Ouvrir la fiche ». Corrigez le contact puis renvoyez : l'encadré disparaît dès
  qu'un nouvel envoi réussit. Le filtre « Envoi en échec » liste ces invitations.
- Le message « Le service d'envoi refuse la connexion » indique un problème de réglage (`.env`, étape 6.1 ou
  6.2), pas une erreur de l'invité.

## 7. Sauvegardes

Automatiques chaque nuit à 3 h, chaque sauvegarde est **vérifiée** en la restaurant dans une base jetable.

| Action                                  | Commande (dans `/opt/mariage`)                                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sauvegarder maintenant                  | `docker compose exec backup sh /scripts/backup.sh`                                                                                                                                                       |
| Lister les sauvegardes                  | `docker compose exec backup ls -lh /backups`                                                                                                                                                             |
| Restaurer (le site s'arrête 1 minute)   | `docker compose stop app worker`, puis `docker compose exec backup sh /scripts/restore.sh mariage-AAAAMMJJ-HHMMSS.dump`, puis `docker compose start app worker`                                          |
| Copier les sauvegardes **sur votre PC** | sur le serveur : `cp -r /var/lib/docker/volumes/mariage_backups/_data /tmp/sauvegardes && chown -R ubuntu /tmp/sauvegardes` ; puis sur le PC : `scp -r ubuntu@ADRESSE_IP:/tmp/sauvegardes .\sauvegardes` |

Avant de restaurer, l'état actuel est lui-même sauvegardé (`avant-restauration-….dump`).
Copiez les sauvegardes sur votre PC **au moins une fois par semaine** pendant la période des réponses :
si le serveur disparaît, elles disparaissent avec lui.

## 8. Mises à jour automatiques (GitHub)

Une fois réglé, il suffit de pousser sur la branche `main` du dépôt GitHub (privé) : les vérifications
automatiques (CI : lint, types, tests, tests navigateur) tournent, et si tout est vert, le workflow
**Déploiement** envoie le code au serveur, qui reconstruit le site, puis vérifie que le site répond.
Choix et sécurité : [`adr/0012-deploiement-continu.md`](adr/0012-deploiement-continu.md).

**Les secrets ne vont jamais sur GitHub** : ceux du site restent dans `/opt/mariage/.env` sur le serveur
(jamais écrasé par un déploiement). GitHub ne garde qu'une **clé de déploiement** qui, sur le serveur, ne peut
lancer qu'une seule commande : `/usr/local/bin/mariage-deploy`.

### 8.1 Sur le serveur (une seule fois, après l'étape 3)

```bash
# un compte « deploy » qui peut seulement utiliser Docker et écrire dans /opt/mariage
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
chown -R deploy:deploy /opt/mariage
[ -f /opt/mariage/.env ] && chmod 600 /opt/mariage/.env
install -m 755 /opt/mariage/scripts/deploy/mariage-deploy.sh /usr/local/bin/mariage-deploy

# la clé de déploiement : elle ne peut lancer que mariage-deploy (« restrict » : ni terminal, ni tunnel)
ssh-keygen -q -t ed25519 -N "" -C github-deploy -f /root/github-deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "command=\"/usr/local/bin/mariage-deploy\",restrict $(cat /root/github-deploy.pub)" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

echo "===== DEPLOY_SSH_KEY (tout copier, lignes BEGIN et END comprises) ====="
cat /root/github-deploy
echo "===== DEPLOY_KNOWN_HOSTS ====="
echo "$(curl -s https://checkip.amazonaws.com) $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

Gardez cette fenêtre ouverte pour l'étape 8.2, puis **effacez la clé du serveur** (GitHub en garde la seule
copie ; en cas de perte, refaites simplement 8.1) :

```bash
rm /root/github-deploy /root/github-deploy.pub
```

> Le script `mariage-deploy` est installé une fois pour toutes. S'il change un jour dans le dépôt, recopiez-le
> avec la ligne `install -m 755 …` ci-dessus (il n'est volontairement pas mis à jour par le déploiement).

### 8.2 Sur GitHub (une seule fois)

Dépôt → _Settings_ → **Environments** → _New environment_ → nom **`production`** :

1. _Deployment branches and tags_ → « Selected branches and tags » → ajoutez **`main`** (seule `main` peut
   déployer).
2. _Environment secrets_ → _Add environment secret_ :
   - `DEPLOY_SSH_KEY` = le bloc affiché après « DEPLOY_SSH_KEY » (de `-----BEGIN` à `END … KEY-----`) ;
   - `DEPLOY_KNOWN_HOSTS` = la ligne affichée après « DEPLOY_KNOWN_HOSTS » (adresse IP puis `ssh-ed25519 …`).
3. _Environment variables_ → _Add environment variable_ :
   - `DEPLOY_HOST` = l'adresse IP du serveur (ex. `15.237.12.34`) ;
   - `PUBLIC_URL` = `https://` + votre domaine (ex. `https://mariage.exemple.fr`).

Premier essai : _Actions_ → **Déploiement** → _Run workflow_. En 5 à 10 minutes, l'étape « Vérification du
site en ligne » doit afficher `✓ … répond`.

### 8.3 Au quotidien

| Je veux…                              | Je fais                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| mettre en ligne une modification      | `git add -A`, `git commit -m "…"`, `git push` : CI puis déploiement automatiques                       |
| redéployer sans rien changer          | GitHub → _Actions_ → **Déploiement** → _Run workflow_ (ne repasse pas par la CI)                       |
| voir pourquoi un déploiement a échoué | GitHub → _Actions_ → le déploiement en rouge → l'étape en erreur affiche le message du serveur         |
| modifier un secret (`.env`)           | sur le serveur : `nano /opt/mariage/.env`, puis `cd /opt/mariage && docker compose up -d`              |
| mettre à jour sans GitHub (secours)   | refaire l'archive et l'envoyer (étape 3), puis `cat /tmp/mariage.tgz \| sudo -u deploy mariage-deploy` |

## 9. Le jour J et après

- Les réponses sont modifiables jusqu'à la date limite réglée dans l'admin (onglet _Modifier la carte_ → réglages).
- Le **19/03/2027**, allergies et coordonnées sont effacées automatiquement (les noms restent).
- Pour tout arrêter définitivement : `docker compose down` (les données restent dans les volumes Docker).
- Après le **19/03/2027**, copiez une dernière sauvegarde sur votre PC (étape 7) si vous voulez garder le plan
  de table, puis **résiliez le VPS** chez l'hébergeur : la facturation s'arrête et le serveur est effacé.
- **Chez AWS** : EC2 → _Instances_ → `mariage` → _État de l'instance_ → **Résilier** (_Terminate_), puis
  _Adresses IP Elastic_ → **Libérer** l'adresse (une adresse gardée sans serveur reste facturée). Le compte
  « Free plan » se ferme de toute façon seul à la fin des 6 mois.

## 10. Dépannage

| Symptôme                                    | Que faire                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Le navigateur dit « certificat invalide »   | le DNS ne pointe pas encore vers le serveur : vérifiez l'enregistrement A, attendez, puis `docker compose restart caddy` |
| `app` redémarre en boucle                   | `docker compose logs app --tail=50` : la variable fautive est indiquée                                                   |
| Les emails n'arrivent pas                   | `docker compose logs worker --tail=50` ; testez avec la commande de l'étape 5                                            |
| Les emails arrivent dans les spams          | le domaine n'est pas vérifié chez Brevo (6.1, étape 2) ou `MAIL_FROM` n'utilise pas ce domaine                           |
| La construction s'arrête (« Killed »)       | le serveur manque de mémoire : faites l'étape 2.5 (mémoire de secours), puis relancez `docker compose up -d --build`     |
| « Trop de tentatives » à la connexion admin | attendez 15 minutes                                                                                                      |
| Mot de passe admin oublié                   | refaites l'étape 4.1, remplacez la ligne dans `.env`, puis `docker compose up -d`                                        |
