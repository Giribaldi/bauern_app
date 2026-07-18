# Plan d'implémentation : MVP Marketplace Locale

## Phase 1 : Fondation (En cours)
- [ ] Initialiser le dépôt Git
- [x] Créer `AGENTS.md`
- [ ] Créer `docs/implementation-plan.md` (ce fichier)
- [ ] Configurer `pnpm-workspace.yaml` (fait)
- [ ] Créer le `package.json` racine avec Turborepo
- [ ] Configurer TypeScript 7 et les outils partagés (lint, format)
- [ ] Créer la structure `apps` (api, storefront, admin, mobile, worker)
- [ ] Créer la structure `packages` (api-client, shared, typescript-config, tooling-config)
- [ ] Configurer Docker et le docker-compose local (PostgreSQL + PostGIS, Mailpit)
- [ ] Configurer les tests et CI locale

## Phase 2 : Base de données et API Publique
- [ ] Configurer Kysely pour PostgreSQL
- [ ] Créer le script de migration et de seed
- [ ] Définir les tables: `users`, `farms`, `farm_members`, `farm_locations` avec PostGIS
- [ ] Définir les tables de catalogue: `product_catalog`, `listings`, `listing_images`
- [ ] Définir le stock: `inventory_batches`, `stock_movements`, `stock_reservations`
- [ ] Implémenter l'API Fastify: `/health`, `/v1/farms/nearby`, `/v1/farms/:farmId/listings`
- [ ] Configurer OpenAPI (swagger) et générer le client TypeScript `packages/api-client`

## Phase 3 : Back-office Admin
- [ ] Authentification API (Argon2id, session cookie)
- [ ] Initialiser TanStack Start pour `apps/admin`
- [ ] Créer l'interface de connexion
- [ ] Créer la page d'une offre (CRUD)
- [ ] Permettre la gestion des stocks (mouvements)
- [ ] Page de commandes et changement de statut

## Phase 4 : Boutique Publique
- [ ] Initialiser TanStack Start pour `apps/storefront`
- [ ] Interface de recherche locale (géolocalisation)
- [ ] Interface des fermes et offres disponibles
- [ ] Gestion du panier côté client / API

## Phase 5 : Checkout Invité et Worker
- [ ] Processus de réservation de stock transactionnel
- [ ] Création de commandes invitées
- [ ] Intégration Stripe (Test mode) et webhooks
- [ ] Création de `apps/worker` pour expirer les réservations et tâches asynchrones

## Phase 6 : Application Mobile
- [ ] Initialiser `apps/mobile` avec Expo
- [ ] Intégrer le client API
- [ ] Implémenter la navigation (recherche, fiche, panier, checkout)
- [ ] Gérer le Deep Link de retour de paiement

## Phase 7 : Finalisation
- [ ] Validation complète, Tests E2E Playwright
- [ ] Optimisation Docker
- [ ] Finaliser la documentation
