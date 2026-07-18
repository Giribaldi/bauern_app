# Local Market MVP

Marketplace locale de fruits et légumes permettant aux agriculteurs de publier leurs produits et aux clients de commander sans créer de compte, avec retrait direct à la ferme.

## État du projet

Le projet est actuellement dans sa phase de fondation.

La Phase 1 comprend :

- le monorepo pnpm et Turborepo ;
- l’API Fastify ;
- le storefront TanStack Start ;
- le back-office TanStack Start ;
- l’application mobile Expo ;
- le worker Node.js ;
- PostgreSQL avec PostGIS ;
- Mailpit ;
- les environnements Docker des applications serveur ;
- le formatage, le lint, le typecheck, les tests et les builds.

La gestion métier de la base de données, les migrations Kysely, les seeds, OpenAPI et le client API généré seront ajoutés pendant la Phase 2.

## Prérequis

- Node.js `24.18.0` ;
- pnpm `10.30.3` ;
- Corepack ;
- Docker avec Docker Compose ;
- pour l’application mobile : Expo Go, un émulateur Android ou un simulateur iOS selon l’environnement utilisé.

La version Node.js attendue est définie dans `.node-version`.

La version pnpm attendue est définie dans le champ `packageManager` du `package.json` racine.

## Installation

Activer pnpm avec Corepack :

```bash
corepack enable pnpm
```

Vérifier les versions :

```bash
node --version
pnpm --version
pnpm exec tsc --version
```

Résultats attendus :

```text
Node.js    v24.18.0
pnpm       10.30.3
TypeScript 7.0.2
```

Installer les dépendances à partir du lockfile :

```bash
pnpm install --frozen-lockfile
```

## Configuration

Copier le fichier d’environnement :

```bash
cp .env.example .env
```

Adapter ensuite les valeurs à l’environnement local.

Ne jamais ajouter de secret réel dans `.env.example` ni committer le fichier `.env`.

## Démarrage avec Docker

Valider la configuration Docker Compose :

```bash
docker compose config
docker compose config --services
```

Construire et lancer l’environnement complet :

```bash
docker compose up --build
```

Pour lancer les services en arrière-plan :

```bash
docker compose up --build -d
```

Services disponibles :

| Service        | Adresse                        |
| -------------- | ------------------------------ |
| API            | `http://localhost:3000`        |
| Santé de l’API | `http://localhost:3000/health` |
| Storefront     | `http://localhost:3001`        |
| Back-office    | `http://localhost:3002`        |
| Mailpit        | `http://localhost:8025`        |
| PostgreSQL     | `localhost:5432`               |
| SMTP Mailpit   | `localhost:1025`               |

L’application mobile Expo n’est pas exécutée dans un conteneur de production.

### État et journaux des services

```bash
docker compose ps
docker compose logs --no-color
```

Afficher les journaux d’un service précis :

```bash
docker compose logs --no-color api
docker compose logs --no-color storefront
docker compose logs --no-color admin
docker compose logs --no-color worker
```

Arrêter les services sans supprimer les volumes :

```bash
docker compose down
```

## Développement local hors Docker

Lancer PostgreSQL et Mailpit :

```bash
docker compose up -d postgres mailpit
```

Lancer les applications du monorepo :

```bash
pnpm dev
```

Les commandes disponibles peuvent également être exécutées pour un workspace précis :

```bash
pnpm --filter api dev
pnpm --filter storefront dev
pnpm --filter admin dev
pnpm --filter worker dev
```

## Application mobile

Lancer l’application Expo depuis la racine :

```bash
pnpm --filter mobile start
```

L’application peut ensuite être ouverte avec Expo Go, un émulateur Android ou un simulateur iOS.

## Contrôles de qualité

Vérifier le formatage :

```bash
pnpm format:check
```

Formater les fichiers pris en charge par Prettier :

```bash
pnpm format
```

Exécuter le lint :

```bash
pnpm lint
```

Vérifier les types avec TypeScript 7 :

```bash
pnpm typecheck
```

Exécuter les tests :

```bash
pnpm test
```

Construire les applications et packages :

```bash
pnpm build
```

Validation complète recommandée :

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Base de données

PostgreSQL et PostGIS sont disponibles dans l’environnement Docker.

Les fonctionnalités suivantes seront ajoutées pendant la Phase 2 :

- connexion Kysely ;
- migrations ;
- rollback ;
- statut des migrations ;
- seed de développement ;
- reset contrôlé de la base ;
- recherche géographique des exploitations.

Les commandes de base de données ne doivent être documentées ici qu’après leur implémentation et leur validation effectives.

## OpenAPI et client TypeScript

La génération du contrat OpenAPI et du client TypeScript partagé sera ajoutée pendant la Phase 2.

Le flux prévu est :

```text
Schémas TypeBox de l’API
        ↓
Document OpenAPI
        ↓
Client TypeScript généré
        ↓
Storefront, back-office et application mobile
```

Les commandes de génération ne doivent être ajoutées à ce README qu’après leur implémentation.

## Comptes de démonstration

Aucun compte de démonstration n’est encore disponible.

Les comptes seront créés par le seed de développement pendant une phase ultérieure.

Les mots de passe de démonstration ne devront jamais être utilisés en production.

## Architecture

```text
apps/
├── api/          API Fastify
├── storefront/   Boutique publique TanStack Start
├── admin/        Back-office TanStack Start
├── mobile/       Application Expo / React Native
└── worker/       Tâches asynchrones

packages/
├── api-client/         Client TypeScript de l’API
├── shared/             Code indépendant des plateformes
└── typescript-config/  Configurations TypeScript partagées
```

Principes principaux :

- l’API Fastify est la source de vérité métier ;
- les applications web et mobile ne doivent jamais accéder directement à PostgreSQL ;
- chaque application serveur possède sa propre image Docker ;
- les applications peuvent être construites et déployées indépendamment ;
- les types HTTP seront générés depuis OpenAPI ;
- les types internes Kysely ne seront pas exposés aux clients.

## Artefacts générés

Les dossiers suivants sont générés localement et ne doivent pas être suivis par Git :

```text
dist/
.output/
.tanstack/
node_modules/
```

Le lockfile `pnpm-lock.yaml` est produit par pnpm et ne doit pas être modifié manuellement ni reformaté avec Prettier.

## Résolution des problèmes

### Un port est déjà utilisé

Identifier le processus :

```bash
ss -ltnp | grep -E ':3000|:3001|:3002|:5432|:8025'
```

Les services Docker utilisent des ports déterministes et ne doivent pas choisir automatiquement un autre port.

### Un conteneur ne démarre pas

```bash
docker compose ps -a
docker compose logs --no-color <service>
```

### pnpm utilise une mauvaise version de Node.js

Vérifier :

```bash
node --version
pnpm exec node --version
type -a pnpm
```

Le shell et pnpm doivent tous les deux utiliser Node.js `24.18.0`.
