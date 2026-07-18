# Local Market MVP

Marketplace locale de fruits et légumes permettant aux agriculteurs de publier leurs produits et aux clients de commander sans créer de compte, avec retrait direct à la ferme.

## Prérequis

- Node.js >= 22
- pnpm >= 9
- Docker & Docker Compose
- L'application mobile nécessite Expo CLI.

## Installation

```bash
pnpm install
```

## Configuration

Copiez le fichier d'environnement et ajustez-le si nécessaire :

```bash
cp .env.example .env
```

## Démarrage (Docker)

La façon la plus simple de lancer l'environnement complet (PostgreSQL, Mailpit, API, Storefront, Admin, Worker) est avec Docker Compose :

```bash
docker compose up --build
```

**Note :** L'application mobile Expo n'est pas lancée via Docker.

## Lancement hors Docker (Développement local)

1. Lancer uniquement la base de données et Mailpit :
   ```bash
   docker compose up postgres mailpit -d
   ```
2. Migrer et remplir la base de données :
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```
3. Lancer les applications en parallèle :
   ```bash
   pnpm dev
   ```

### Lancement de l'application mobile

Depuis la racine du projet, lancez :

```bash
pnpm --filter mobile start
```

## Migrations de la Base de Données

Les migrations se trouvent dans `apps/api/src/db/migrations`.

- `pnpm db:migrate` : Exécute les migrations.
- `pnpm db:rollback` : Annule la dernière migration.
- `pnpm db:seed` : Ajoute les données de test.

## Génération du client API

Pour générer ou mettre à jour le client TS à partir de Fastify :

```bash
# 1. Générer le fichier openapi.json depuis l'API
pnpm api:openapi
# 2. Générer les types dans packages/api-client
pnpm api:client:generate
```

## Tests

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Comptes de Démonstration

(Sera défini après le seed)

- Administrateur: admin@localmarket.test / password
- Agriculteur: farmer@localmarket.test / password

## Architecture

- **API** : Fastify (Port 3000)
- **Storefront** : TanStack Start (Port 3001)
- **Admin** : TanStack Start (Port 3002)
- **Base de données** : PostgreSQL + PostGIS (Port 5432)
- **Mail** : Mailpit (Port 8025 pour l'interface web)
