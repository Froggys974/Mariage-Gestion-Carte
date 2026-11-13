# Raccourcis. Chaque cible a son équivalent pnpm (indiqué en commentaire) pour Windows sans make.
# Sur le serveur, `.env` contient COMPOSE_FILE=docker-compose.prod.yml : `docker compose` vise alors la prod.

PROD := docker compose -f docker-compose.prod.yml

.PHONY: help dev down build test e2e lint typecheck migrate seed prod-up prod-down logs backup restore backups create-admin-hash test-mail

help: ## Liste des commandes
	@grep -E "^[a-z-]+:.*## " $(MAKEFILE_LIST) | awk -F ":.*## " '{printf "  %-20s %s\n", $$1, $$2}'

dev: ## Lance le site en développement (pnpm docker:dev)
	docker compose up --build

down: ## Arrête l'environnement de dev (pnpm docker:down)
	docker compose down

build: ## Construit l'application (pnpm build)
	pnpm build

test: ## Tests unitaires (pnpm test)
	pnpm test

e2e: ## Tests de bout en bout Playwright (pnpm e2e)
	pnpm e2e

lint: ## ESLint + Prettier (pnpm lint)
	pnpm lint

typecheck: ## Vérification des types (pnpm typecheck)
	pnpm typecheck

migrate: ## Applique les migrations (pnpm docker:migrate)
	docker compose run --rm migrate

seed: ## Données de démonstration (pnpm docker:seed)
	docker compose exec app node scripts/run.mjs seed

prod-up: ## Construit et démarre la production (pnpm prod:up)
	$(PROD) up -d --build

prod-down: ## Arrête la production (pnpm prod:down)
	$(PROD) down

logs: ## Journaux de production (pnpm prod:logs)
	$(PROD) logs -f --tail=200

backup: ## Sauvegarde immédiate de la base (pnpm backup)
	$(PROD) exec backup sh /scripts/backup.sh

backups: ## Liste les sauvegardes (pnpm backups:list)
	$(PROD) exec backup ls -lh /backups

restore: ## Restaure une sauvegarde : make restore FILE=mariage-AAAAMMJJ-HHMMSS.dump (pnpm restore <fichier>)
	$(PROD) stop app worker
	$(PROD) exec backup sh /scripts/restore.sh $(FILE)
	$(PROD) start app worker

create-admin-hash: ## Génère le hash du mot de passe admin (pnpm create-admin-hash)
	@if [ -f dist/scripts/create-admin-hash.mjs ] || [ -d node_modules ]; then pnpm create-admin-hash; \
	else $(PROD) run --rm --no-deps app node scripts/run.mjs create-admin-hash; fi

test-mail: ## Envoie un email de test : make test-mail TO=vous@example.re (pnpm test-mail / pnpm prod:test-mail)
	docker compose exec app node scripts/run.mjs test-mail $(TO)
