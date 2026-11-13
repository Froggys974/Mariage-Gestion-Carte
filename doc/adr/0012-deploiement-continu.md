# 0012 — Déploiement continu : GitHub Actions → SSH → Docker Compose sur le serveur

## Contexte

Le site tourne sur un seul serveur (AWS `t4g.small`, ARM, Stockholm) jusqu'au 19/03/2027. Les mariés veulent
que chaque modification poussée sur GitHub (dépôt privé) soit mise en ligne automatiquement, sans manipuler
d'archive, et avec des secrets bien protégés.

Options écartées :

- **Docker Swarm / Kubernetes** : utiles pour plusieurs serveurs et des mises à jour sans coupure ; ici, un seul
  serveur pour 4 mois : complexité sans bénéfice.
- **Image construite sur GitHub et publiée dans un registre** : demande un registre, un jeton de lecture sur
  le serveur et un build ARM (émulé, lent, ou runners ARM). Le serveur construit l'image en 5 à 10 min.
- **Le serveur fait `git pull`** : il faudrait lui donner un accès au dépôt privé (clé de lecture).

## Décision

1. Workflow **Déploiement** (`.github/workflows/deploy.yml`) déclenché quand la **CI est verte sur `main`**
   (`workflow_run`), ou à la main (`workflow_dispatch`). Un seul déploiement à la fois.
2. Il envoie `git archive HEAD` par SSH au compte **`deploy`** du serveur, puis vérifie
   `PUBLIC_URL/api/health` (5 min au plus).
3. Côté serveur, la clé de GitHub a une **commande forcée** (`command="/usr/local/bin/mariage-deploy",restrict`
   dans `authorized_keys`) : quoi que demande le client, seul le script de déploiement s'exécute, sans
   terminal ni tunnel. Le script (`scripts/deploy/mariage-deploy.sh`) remplace le code de `/opt/mariage` en
   gardant `.env`, puis `docker compose up -d --build`. Il est installé par root et n'est pas modifiable par
   un déploiement.
4. **Secrets** :
   - ceux du site restent **uniquement** dans `/opt/mariage/.env` (droits 600, compte `deploy`) ;
   - GitHub ne garde que `DEPLOY_SSH_KEY` et `DEPLOY_KNOWN_HOSTS` (empreinte du serveur : refus d'un faux
     serveur), dans l'environnement protégé **`production`**, limité à la branche `main`, passés au script par
     variables d'environnement (jamais interpolés dans les commandes) et effacés en fin de job.
5. Le compte `deploy` est dans le groupe `docker` (équivalent root) : accepté, car quiconque peut pousser sur
   `main` peut de toute façon changer le code exécuté. La protection porte donc sur l'accès au dépôt
   (privé, compte GitHub protégé par double authentification).

## Conséquences

- Coupure de quelques secondes à chaque déploiement (recréation des conteneurs) ; les migrations passent par
  le service `migrate` avant le démarrage de `app`.
- Le premier déploiement sans `.env` installe le code puis s'arrête avec un message clair (code 2).
- Secours sans GitHub : `cat archive.tgz | sudo -u deploy mariage-deploy` (doc/CONFIGURATION.md § 8.3).
