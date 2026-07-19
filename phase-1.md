# Phase 1 — Fondation technique et stabilisation

## Statut

**État actuel : terminé.**

La fondation technique fonctionne déjà de bout en bout, mais la Phase 1 ne doit être déclarée terminée qu'après résolution du dernier point de cohérence TypeScript :

- TypeScript 7.0.2 est bien utilisé par les commandes de compilation et de typecheck ;
- TypeScript 6.0.3 est encore déclaré dans certains manifestes ;
- il doit être supprimé ou isolé exclusivement dans l'outillage ESLint ;
- l'audit final complet doit ensuite être rejoué depuis un dépôt propre.

## Objectif de la phase

Mettre en place une base technique reproductible et suffisamment stable pour développer le métier sans devoir réorganiser le projet à chaque nouvelle fonctionnalité.

La Phase 1 ne contient volontairement presque aucune logique métier. Elle garantit que les applications peuvent :

- être installées ;
- être vérifiées ;
- être testées ;
- être construites ;
- être exécutées localement ;
- être exécutées avec Docker ;
- évoluer indépendamment dans un même monorepo.

## Architecture retenue

```text
local-market/
├── apps/
│   ├── api/          API Fastify centrale
│   ├── storefront/   Boutique publique TanStack Start
│   ├── admin/        Back-office TanStack Start
│   ├── mobile/       Application Expo / React Native
│   └── worker/       Tâches asynchrones
│
├── packages/
│   ├── api-client/         Futur client OpenAPI partagé
│   ├── shared/             Code indépendant des plateformes
│   └── typescript-config/  Configuration TypeScript partagée
│
├── docs/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Choix techniques validés

| Domaine                 | Choix                                          |
| ----------------------- | ---------------------------------------------- |
| Organisation            | Monorepo pnpm + Turborepo                      |
| Runtime                 | Node.js 24.18.0                                |
| Gestionnaire de paquets | pnpm 10.30.3 via Corepack                      |
| Langage                 | TypeScript 7.0.2 pour les builds et typechecks |
| API                     | Fastify                                        |
| Web public              | TanStack Start                                 |
| Back-office             | TanStack Start                                 |
| Mobile                  | Expo + React Native                            |
| Build web               | Vite 7.3.6                                     |
| UI web                  | React 18.3.1                                   |
| Tests                   | Vitest                                         |
| Conteneurs              | Docker + Docker Compose                        |
| Base locale             | PostgreSQL 15 + PostGIS 3.3                    |
| E-mails locaux          | Mailpit                                        |

## Services Docker

Le fichier Compose expose les services suivants :

```text
postgres
mailpit
api
worker
storefront
admin
```

Ports de développement :

| Service      | Port |
| ------------ | ---: |
| API          | 3000 |
| Storefront   | 3001 |
| Admin        | 3002 |
| PostgreSQL   | 5432 |
| Mailpit SMTP | 1025 |
| Mailpit Web  | 8025 |

L'application mobile Expo n'est pas exécutée comme service Docker de production.

## Travail déjà réalisé

### Monorepo

- initialisation des workspaces pnpm ;
- orchestration des tâches avec Turborepo ;
- scripts globaux de build, test, lint et typecheck ;
- configuration partagée TypeScript ;
- séparation des applications et packages.

### API

- application Fastify minimale ;
- route `GET /health` ;
- test avec `fastify.inject()` ;
- image Docker dédiée ;
- healthcheck Docker.

### Storefront et administration

- applications TanStack Start séparées ;
- Vite 7.3.6 ;
- build client et SSR ;
- tests de base ;
- images Docker distinctes ;
- endpoints HTTP validés.

### Worker

- point d'entrée Node.js ;
- build et test minimaux ;
- image Docker dédiée.

### Mobile

- application Expo initialisée ;
- exécution hors Docker ;
- intégration dans le workspace.

### Qualité

- Prettier ;
- ESLint ;
- TypeScript 7 pour les contrôles ;
- Vitest ;
- builds reproductibles ;
- artefacts `dist`, `.output` et `.tanstack` exclus de Git ;
- lockfile exclu de Prettier ;
- installation figée avec `pnpm install --frozen-lockfile`.

### Environnement

- Node.js aligné entre le shell, pnpm et Docker ;
- pnpm exécuté avec le même runtime Node que le projet ;
- PostgreSQL et PostGIS vérifiés ;
- Mailpit vérifié ;
- six services Docker démarrés avec succès.

## Point restant avant validation

### Cohérence TypeScript

L'état attendu est :

```text
Applications, packages, builds et typechecks
→ TypeScript 7.0.2

TypeScript 6.0.3
→ absent ou isolé uniquement dans un package d'outillage ESLint
```

Aucun package applicatif ou partagé ne doit déclarer directement TypeScript 6.

Le correctif doit :

1. auditer la nécessité réelle de TypeScript 6 pour ESLint ;
2. supprimer TypeScript 6 si l'écosystème actuel fonctionne avec TypeScript 7 ;
3. sinon l'isoler dans un package d'outillage dédié ;
4. conserver TypeScript 7.0.2 pour tous les builds et typechecks ;
5. régénérer le lockfile uniquement avec pnpm ;
6. vérifier que le lint analyse toujours réellement les fichiers `.ts` et `.tsx`.

## Hors périmètre de la Phase 1

Ne pas ajouter pendant cette phase :

- Kysely ;
- migrations ;
- modèle métier ;
- catalogue ;
- stocks ;
- commandes ;
- paiements ;
- authentification ;
- OpenAPI ;
- client API généré ;
- recherche géographique métier.

## Commandes de validation

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Vérification des versions :

```bash
node --version
pnpm --version
pnpm exec node --version
pnpm exec tsc --version
```

Vérification Docker :

```bash
docker compose config
docker compose config --services
docker compose build api worker storefront admin
docker compose down
docker compose up -d
docker compose ps
docker compose logs --no-color
```

Vérification HTTP :

```bash
curl --fail http://localhost:3000/health
curl --fail http://localhost:3001/
curl --fail http://localhost:3002/
curl --fail http://localhost:8025/
```

Vérification PostGIS :

```bash
docker compose exec -T postgres \
  psql -U <utilisateur> -d <base> \
  -c "SELECT PostGIS_Full_Version();"
```

Vérification Git :

```bash
git status --short
git diff --check
git ls-files ':(glob)**/dist/**'
git ls-files ':(glob)**/.output/**'
git ls-files ':(glob)**/.tanstack/**'
```

## Critères d'acceptation

La Phase 1 est terminée uniquement lorsque :

- le dépôt est propre avant et après l'audit ;
- Node 24.18.0 est utilisé par le shell, pnpm et Docker ;
- TypeScript 7.0.2 est le compilateur de tous les workspaces ;
- TypeScript 6 est absent ou isolé dans l'outillage ESLint ;
- Vite 7.3.6 est utilisé pour les applications web ;
- aucune dépendance directe à Vinxi, `@tanstack/start` ou Next.js n'existe ;
- installation, formatage, lint, typecheck, tests et builds réussissent ;
- les images Docker sont construites ;
- les six services démarrent ;
- les endpoints HTTP répondent ;
- PostgreSQL et PostGIS répondent ;
- aucun artefact de build n'est suivi ;
- aucune commande de validation ne modifie Git.

## Livrables de la phase

- monorepo fonctionnel ;
- applications minimales ;
- environnement Docker ;
- documentation `README.md` et `AGENTS.md` ;
- scripts de qualité ;
- audit final de Phase 1 ;
- commit de référence stable.

## Reprise avec un agent

Avant toute intervention :

```bash
git status --short
git diff --check
```

L'agent doit :

- travailler sur une seule micro-tâche ;
- ne jamais commencer la Phase 2 avant validation ;
- ne jamais modifier le lockfile manuellement ;
- ne jamais réintroduire Vinxi ;
- ne jamais déclarer une commande réussie sans l'avoir exécutée ;
- s'arrêter immédiatement si une validation produit un résultat inattendu.

## Prochaine action

Terminer la micro-tâche d'unification TypeScript, puis rejouer l'audit complet.

Verdict attendu :

```text
PHASE 1 VALIDÉE
```
