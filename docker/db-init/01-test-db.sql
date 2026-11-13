-- Développement uniquement : base jetable des tests (pnpm test avec TEST_DATABASE_URL, pnpm e2e).
-- Exécuté par l'image postgres au tout premier démarrage du volume.
CREATE DATABASE mariage_test;
