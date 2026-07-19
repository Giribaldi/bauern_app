# AGENTS.md

## Objectif

Ce fichier définit les règles obligatoires pour tout agent travaillant dans ce dépôt.

Un agent doit privilégier :

1. l’intégrité des données ;
2. la sécurité ;
3. les modifications minimales ;
4. la reproductibilité ;
5. la qualité des types ;
6. la maintenabilité.

Une tâche n’est jamais considérée réussie uniquement parce que du code a été créé. Elle doit être vérifiée avec les commandes adaptées.

## Phase actuelle

Le projet est actuellement dans sa phase de fondation.

Ne commence pas une phase suivante sans demande explicite.

Les migrations Kysely, le schéma métier, OpenAPI et le client généré appartiennent à la Phase 2 et ne doivent pas être implémentés pendant une tâche de validation de la Phase 1.

## Versions de référence

Le projet utilise :

```text
Node.js              24.18.0
pnpm                 10.30.3
TypeScript           7.0.2
Vite                 7.3.6
@vitejs/plugin-react 4.7.0
React                18.3.1
React DOM            18.3.1
```

La version Node.js est définie dans `.node-version`.

La version pnpm est définie dans le champ `packageManager` du `package.json` racine.

Ne modifie pas ces versions dans le cadre d’une autre tâche sans demande explicite.

## Architecture

Le projet est un monorepo pnpm et Turborepo.

### Applications

- `apps/api` : API Fastify centrale ;
- `apps/storefront` : boutique publique TanStack Start ;
- `apps/admin` : back-office TanStack Start ;
- `apps/mobile` : application Expo et React Native ;
- `apps/worker` : tâches asynchrones.

### Packages

- `packages/api-client` : client HTTP TypeScript partagé ;
- `packages/eslint-runtime` : environnement ESLint isolé avec sa couche de compatibilité TypeScript ;
- `packages/shared` : code indépendant des plateformes ;
- `packages/typescript-config` : configurations TypeScript partagées.

## Frontières architecturales

L’API Fastify est l’unique source de vérité métier.

Le storefront, le back-office et l’application mobile ne doivent jamais :

- accéder directement à PostgreSQL ;
- importer les types internes Kysely ;
- gérer directement les réservations de stock ;
- confirmer un paiement ;
- reproduire les règles métier du backend.

Les fonctions serveur TanStack Start peuvent servir à :

- lire des cookies ;
- effectuer des redirections ;
- préparer le rendu serveur ;
- appeler l’API.

Elles ne doivent pas devenir une seconde API métier.

L’application mobile doit pouvoir utiliser les mêmes endpoints HTTP que les applications web.

## Technologies imposées

Utiliser :

- Fastify pour l’API ;
- TanStack Start pour le storefront et le back-office ;
- Expo et React Native pour le mobile ;
- Kysely pour les futurs accès PostgreSQL ;
- PostgreSQL et PostGIS ;
- TypeBox pour les contrats Fastify ;
- OpenAPI pour le contrat partagé ;
- Vitest pour les tests ;
- Playwright pour les futurs tests end-to-end ;
- Docker pour les applications serveur.

Ne pas introduire :

- Next.js ;
- Prisma ;
- Drizzle ;
- TypeORM ;
- Sequelize ;
- une dépendance directe à Vinxi ;
- `@tanstack/start` à la place de `@tanstack/react-start` ;
- des Git submodules.

## Méthode de travail obligatoire

### Avant toute modification

Exécuter :

```bash
git status --short
git diff --check
git diff --stat
git diff
```

Lire ensuite :

- la demande utilisateur ;
- ce fichier ;
- les fichiers directement concernés ;
- les scripts disponibles dans les `package.json`.

Ne pas supposer qu’une commande existe sans l’avoir vérifiée.

### Périmètre

Une tâche doit avoir un objectif unique.

Ne pas :

- commencer la tâche suivante ;
- modifier une autre application sans nécessité ;
- mettre à jour des dépendances hors périmètre ;
- effectuer un refactoring général non demandé ;
- corriger silencieusement un problème découvert pendant un audit.

Lors d’une tâche de validation, aucune correction n’est autorisée sauf demande explicite.

### Modification des fichiers

Modifier les fichiers de manière structurée.

Pour un fichier JSON :

- ne pas utiliser de remplacement par expression régulière ;
- ne pas utiliser une commande `sed` complexe ;
- valider ensuite le JSON.

Pour les dépendances :

- utiliser pnpm ;
- ne pas éditer manuellement `pnpm-lock.yaml` ;
- ne pas passer le lockfile dans Prettier ;
- inspecter les changements de versions et de résolutions.

### Après toute modification

Exécuter :

```bash
git diff --check
git diff --stat
git diff
git status --short
```

Rapporter exactement :

- les fichiers modifiés ;
- les commandes exécutées ;
- les validations réussies ;
- les validations échouées ;
- les avertissements restants.

Ne jamais annoncer qu’une commande a réussi sans l’avoir réellement exécutée.

## Git et artefacts générés

Les dossiers suivants ne doivent jamais être suivis :

```text
**/dist/
**/.output/
**/.tanstack/
**/node_modules/
```

Après un build, vérifier :

```bash
git ls-files ':(glob)**/dist/**'
git ls-files ':(glob)**/.output/**'
git ls-files ':(glob)**/.tanstack/**'
git status --short
```

Un build ne doit pas créer de modification Git supplémentaire.

Les fichiers générés destinés à être versionnés doivent être explicitement documentés. Ils ne doivent jamais être modifiés manuellement.

Lorsque le client OpenAPI sera disponible, les fichiers sous :

```text
packages/api-client/src/generated/
```

seront générés automatiquement et ne devront jamais être édités manuellement.

## Commandes obligatoires

Installation reproductible :

```bash
pnpm install --frozen-lockfile
```

Vérifications générales :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Vérification de TypeScript :

```bash
pnpm exec tsc --version
```

Le résultat attendu est :

```text
Version 7.0.2
```

TypeScript 7.0.2 est l’unique compilateur des applications et packages. Tous les builds et typechecks l’utilisent.

TypeScript 6.0.3 est uniquement autorisé dans `packages/eslint-runtime` comme couche de compatibilité temporaire pour `typescript-eslint`. Il ne doit jamais être utilisé pour les builds ou typechecks.

Pour une modification Docker :

```bash
docker compose config
docker compose config --services
docker compose build api worker storefront admin
docker compose up -d
docker compose ps
docker compose logs --no-color
```

Pour une modification concernant un seul workspace, commencer par ses commandes ciblées :

```bash
pnpm --filter <workspace> typecheck
pnpm --filter <workspace> test
pnpm --filter <workspace> build
```

Puis exécuter les contrôles globaux avant de conclure.

## Base de données

À partir de la Phase 2 :

- Kysely sera l’unique couche d’accès PostgreSQL ;
- les migrations seront la source de vérité du schéma ;
- aucune synchronisation automatique du schéma ne sera autorisée ;
- les migrations devront avoir des fonctions `up` et `down` ;
- les migrations devront rester indépendantes des modèles applicatifs actuels ;
- les opérations critiques utiliseront des transactions ;
- la recherche géographique utilisera PostGIS ;
- les quantités et prix ne devront pas utiliser de nombres flottants imprécis.

Une migration ne doit jamais être annoncée comme fonctionnelle sans avoir été testée sur une base vide.

## Contrat API

À partir de la Phase 2, le partage des types suivra ce flux :

```text
TypeBox
  ↓
OpenAPI
  ↓
Client TypeScript généré
  ↓
Storefront, back-office et mobile
```

Ne jamais exposer directement :

- les types Kysely ;
- les lignes de la base ;
- des colonnes internes ;
- des secrets serveur.

Toutes les entrées HTTP devront être validées à l’exécution.

## Sécurité

Interdictions :

- aucun mot de passe en clair ;
- aucun secret committé ;
- aucun jeton complet dans les logs ;
- aucun `any` pour contourner une erreur ;
- aucun `@ts-ignore` sans justification locale documentée ;
- aucune désactivation globale d’une règle pour faire passer une tâche ;
- aucune confiance accordée à un `farmId` fourni par un client.

Les mots de passe utiliseront Argon2id.

Les opérations du back-office vérifieront systématiquement que l’utilisateur appartient à l’exploitation concernée.

Les futures réservations de stock devront être transactionnelles et empêcher la survente.

Les confirmations de paiement devront provenir d’un webhook signé et idempotent.

## Tests

Une modification fonctionnelle doit être accompagnée de tests adaptés.

Selon le cas :

- test unitaire ;
- test Fastify avec `inject()` ;
- test d’intégration avec PostgreSQL/PostGIS réel ;
- smoke test HTTP ;
- test end-to-end Playwright.

Ne pas remplacer PostgreSQL ou PostGIS par un mock pour valider une fonctionnalité qui en dépend réellement.

Ne pas faire passer un test en :

- supprimant une assertion ;
- réduisant artificiellement sa portée ;
- ignorant une erreur ;
- codant le résultat attendu en dur.

## Définition de terminé

Une tâche est terminée uniquement lorsque :

- le périmètre demandé est respecté ;
- le code est formaté ;
- le lint passe ;
- le typecheck passe avec TypeScript 7.0.2 ;
- les tests concernés passent ;
- les builds concernés passent ;
- le dépôt ne contient pas de nouvel artefact suivi ;
- le lockfile est cohérent ;
- les erreurs sont gérées ;
- la documentation est mise à jour lorsque nécessaire ;
- les commandes réellement exécutées sont rapportées ;
- les limites ou avertissements restants sont signalés.

Pour une modification Docker, il faut également vérifier :

- la construction de l’image ;
- le démarrage du conteneur ;
- son état de santé ;
- son endpoint HTTP lorsqu’il en possède un.

## Rapport final d’une tâche

Le rapport doit contenir :

```text
Travail réalisé
Fichiers modifiés
Commandes exécutées
Tests exécutés
Résultats
Avertissements
Limites
État Git final
```

Ne jamais inclure de section « Thought Process ».

Ne jamais dupliquer le rapport.

Ne jamais annoncer une tâche suivante comme déjà commencée.

En cas d’échec, indiquer clairement :

- la commande échouée ;
- l’erreur exacte ;
- les étapes non exécutées ;
- la correction minimale nécessaire.

## Orchestration des agents

### Rôles

Codex est l’unique maître d’orchestration du projet.

Codex reste responsable :

- de l’analyse initiale ;
- du découpage de la tâche ;
- des décisions d’architecture ;
- du choix des travaux à déléguer ;
- de la revue des résultats ;
- de l’intégration finale ;
- de l’exécution des validations ;
- du rapport final.

Antigravity est uniquement un sous-agent spécialisé appelé par Codex au moyen des outils MCP disponibles.

Antigravity ne doit jamais devenir l’orchestrateur principal et ne doit jamais déléguer à un autre agent.

### Conditions préalables à une délégation

Avant toute délégation à Antigravity, Codex doit :

1. lire la demande utilisateur et le présent fichier ;
2. déterminer un objectif unique et borné ;
3. identifier explicitement les fichiers ou dossiers autorisés ;
4. vérifier l’état du dépôt avec :

```bash
git status --short
git diff --check
git diff --stat
git diff
```

5. vérifier que le dépôt principal est dans un état compatible avec la création d’un worktree isolé ;
6. ne transmettre aucun secret, jeton, fichier `.env`, credential ou donnée sensible.

Un dépôt principal contenant des modifications non enregistrées ne doit pas être délégué à Antigravity, sauf si Codex démontre explicitement que ces modifications ne sont pas nécessaires à la tâche et qu’elles ne risquent pas de fausser le résultat.

### Cas autorisés de délégation

Utiliser `antigravity_analyze` pour :

- obtenir un second avis ;
- analyser une partie indépendante du dépôt ;
- rechercher la cause possible d’un bug ;
- effectuer une revue de code ;
- comparer plusieurs solutions techniques ;
- identifier des risques ou des tests manquants ;
- analyser une tâche sans modifier les fichiers.

Utiliser `antigravity_propose_patch` uniquement lorsque :

- la tâche est clairement définie ;
- le périmètre des fichiers est explicitement limité ;
- les modifications peuvent être réalisées dans un worktree Git isolé ;
- Codex prévoit de lire la totalité du patch ;
- Codex prévoit de relancer lui-même les validations ;
- aucune opération sensible ou irréversible n’est nécessaire.

Ne pas déléguer à Antigravity :

- une décision d’architecture structurante sans revue Codex ;
- une migration de base de données non demandée ;
- une modification de schéma ou de contrat API hors phase autorisée ;
- une mise à jour générale des dépendances ;
- un déploiement ;
- une publication ;
- une fusion Git ;
- une opération nécessitant des secrets ;
- une tâche dont le périmètre ne peut pas être clairement borné.

### Isolation obligatoire

Toute tâche Antigravity susceptible de modifier des fichiers doit être exécutée dans un worktree Git isolé.

Antigravity ne doit jamais modifier directement le worktree principal.

Antigravity ne doit jamais :

- effectuer un `git push` ;
- fusionner une branche ;
- rebaser une branche partagée ;
- modifier la branche principale ;
- créer ou modifier un tag ;
- publier un paquet ;
- déployer une application ;
- modifier une configuration distante ;
- accéder volontairement à des fichiers situés hors du worktree assigné ;
- utiliser un mode de contournement global des permissions sans demande explicite de l’utilisateur.

Les worktrees créés pour Antigravity sont temporaires et doivent être supprimés après revue, sauf besoin explicite de conservation pour investigation.

### Périmètre des fichiers

Lors d’un appel à `antigravity_propose_patch`, Codex doit fournir une liste explicite des chemins autorisés.

Antigravity ne doit modifier aucun fichier situé hors de cette liste.

Si le patch contient une modification hors périmètre :

1. Codex doit la signaler ;
2. Codex doit la rejeter ;
3. Codex ne doit pas intégrer le patch complet ;
4. Codex doit déterminer si le reste du résultat reste exploitable.

Les fichiers suivants sont interdits par défaut lors d’une délégation, sauf demande utilisateur explicite :

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
**/credentials*
**/secrets*
.git/**
node_modules/**
dist/**
.output/**
.tanstack/**
```

### Revue obligatoire du résultat

Un résultat produit par Antigravity n’est jamais considéré comme validé.

Après une délégation, Codex doit :

1. lire le résultat structuré de l’exécution ;
2. lire la totalité du patch avec `antigravity_read_patch` lorsque nécessaire ;
3. inspecter tous les fichiers modifiés ;
4. vérifier le respect du périmètre ;
5. rechercher les modifications inutiles ou opportunistes ;
6. vérifier l’absence de secret ou de donnée sensible ;
7. vérifier les changements de dépendances et de lockfile ;
8. vérifier la conformité avec l’architecture et la phase actuelle ;
9. rejeter toute modification non justifiée.

Codex ne doit jamais annoncer qu’un résultat Antigravity est correct uniquement parce que l’agent affirme avoir réussi.

### Intégration

Codex reste responsable de l’intégration dans le worktree principal.

Par défaut, Codex doit préférer :

- réimplémenter les changements acceptés ;
- ou appliquer uniquement les parties explicitement revues du patch.

Codex ne doit pas fusionner automatiquement la branche temporaire complète.

Avant toute intégration, Codex doit présenter les risques ou anomalies identifiés lorsque ceux-ci sont significatifs.

### Validations après intégration

Les validations exécutées par Antigravity sont informatives mais ne remplacent jamais celles de Codex.

Après intégration dans le worktree principal, Codex doit exécuter lui-même les commandes adaptées à la tâche.

Selon le périmètre, commencer par les validations ciblées :

```bash
pnpm --filter <workspace> typecheck
pnpm --filter <workspace> test
pnpm --filter <workspace> build
```

Puis exécuter les contrôles globaux nécessaires :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Codex doit également exécuter :

```bash
git diff --check
git diff --stat
git diff
git status --short
```

Une commande exécutée uniquement par Antigravity ne doit pas être présentée comme une validation effectuée par Codex.

### Nettoyage

Après acceptation ou rejet du travail délégué, Codex doit utiliser `antigravity_cleanup` pour supprimer :

- le worktree temporaire ;
- la branche temporaire, lorsqu’elle n’est plus nécessaire.

Le nettoyage ne doit être effectué qu’après :

- lecture complète du résultat ;
- conservation éventuelle du patch utile ;
- intégration ou rejet explicite des modifications.

Les logs et artefacts d’exécution peuvent être conservés pour audit ou diagnostic.

### Rapport final

Le rapport final doit distinguer clairement :

```text
Travail réalisé par Codex
Travail délégué à Antigravity
Résultat de la revue Codex
Modifications retenues
Modifications rejetées
Commandes exécutées par Codex
Commandes rapportées par Antigravity
Tests exécutés par Codex
Résultats
Avertissements
Limites
État Git final
```

Ne jamais présenter le travail d’Antigravity comme ayant été directement réalisé ou validé par Codex.

Ne jamais inclure les raisonnements internes, chaînes de pensée ou contenus de type « Thought Process » d’un agent.
