# AGENTS.md

## Architecture

Le projet est un monorepo pnpm contenant plusieurs applications :

- `apps/api` : API Fastify centrale gérant les données métier via PostgreSQL/PostGIS.
- `apps/storefront` : Boutique publique utilisant TanStack Start.
- `apps/admin` : Back-office pour les agriculteurs, en TanStack Start.
- `apps/mobile` : Application mobile en Expo/React Native.
- `apps/worker` : Worker de tâches d'arrière-plan (libération de stock, e-mails).
- `packages/api-client` : Client HTTP TypeScript généré à partir de l'OpenAPI.

## Conventions

- Les dépendances sont gérées avec `pnpm`.
- Le build et l'exécution utilisent `turbo`.
- TypeScript 7 est exigé partout.
- Les fichiers générés (dans `packages/api-client/src/generated/`) ne doivent **jamais** être modifiés manuellement.
- La base de données est gérée par Kysely (migrations et accès).
- Le backend (Fastify) est l'unique source de vérité. Le storefront et le back-office ne doivent jamais implémenter de logique métier complexe ni accéder directement à PostgreSQL.

## Sécurité

- Pas de `any` ou `@ts-ignore` sans justification.
- Pas de mots de passe en clair (utiliser Argon2id).
- Toujours vérifier l'appartenance d'un `farmId` à la session en cours dans le back-office.
- Les réservations de stock se font en transaction avec verrouillage en base de données pour empêcher la sur-vente.

## Commandes obligatoires

- `pnpm install` : Installation.
- `pnpm lint` : Lint du projet.
- `pnpm typecheck` : Vérification TypeScript.
- `pnpm test` : Lancer les tests.
- `pnpm db:migrate` : Migrer la base de données.
- `docker compose up --build` : Lancement complet des services.

## Définition de "Terminé"

Une fonctionnalité est considérée terminée lorsque :

- Le code est formaté, typé, linté.
- Les tests unitaires/intégration sont ajoutés et passent.
- L'interface client l'intègre.
- Les erreurs sont gérées.
- Le backend valide correctement et maintient la cohérence métier.
