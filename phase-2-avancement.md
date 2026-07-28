# Phase 2 — Avancement

Ce registre constitue le point de reprise persistant de la Phase 2 du projet.

Principes de gouvernance :

- `phase-2.md` reste la source de vérité du périmètre applicatif et technique.
- `AGENTS.md` reste la source de vérité des règles de travail et d'exécution.
- Une tâche est considérée comme VALIDÉE uniquement si son rapport confirme l'ensemble des validations exigées.
- Un prompt préparé ou transmitted n'est pas une tâche terminée.
- Une tâche échouée ou partiellement validée ne permet pas de poursuivre comme si elle avait réussi.
- Aucune valeur secrète (mot de passe, jeton, URL de connexion complète) ne doit être inscrite dans ce registre.

## Conception des prompts Gemini

Les futurs prompts destinés à Gemini doivent rester complets mais compacts afin de limiter les omissions :

- viser généralement 80 à 120 lignes et une seule micro-tâche ;
- renvoyer à `AGENTS.md` au lieu d'en recopier les règles ;
- faire lire uniquement les sections pertinentes de `phase-2.md` ;
- conserver cinq blocs principaux : objectif, périmètre des fichiers, contrat et tests, commandes, rapport ;
- fournir une seule commande ESLint correcte via `@local-market/eslint-runtime` ;
- utiliser les tests source ciblés comme référence pour leur nombre et signaler séparément les doublons éventuels sous `dist` ;
- n'imposer qu'un seul passage global final pour une tâche normale ;
- réserver les doubles validations globales, empreintes SHA-256 et procédures détaillées aux diagnostics ou corrections qui les nécessitent réellement ;
- en cas d'échec, demander simplement l'arrêt immédiat, l'absence de correction hors périmètre et le rapport de la commande et de l'erreur exactes ;
- mettre à jour ce registre avec le résultat réel après les validations, puis vérifier son formatage et l'état Git final.

## Point de reprise de référence

- Phase 1 validée.
- Commit de référence : `49ad7eb fix(mobile): include app in global typecheck`.
- Working tree propre au début de la Phase 2.
- Node.js : 24.18.0 via NVM.
- pnpm : 10.30.3.
- TypeScript : 7.0.2.
- Validations de Phase 1 déjà acquises, sans en refaire un audit détaillé.
- Aucune migration, table métier, seed, connexion Kysely, route `/ready` ou route `/v1/farms` n'est encore implémentée.

## Légende des statuts

- **VALIDÉE** : Tâche exécutée, vérifiée et conforme à l'ensemble des exigences avec rapport d'exécution validé.
- **NON VALIDÉE** : Tâche exécutée ou livrée mais rejetée ou incomplète en raison de manquements documentés.
- **À FAIRE** : Tâche identifiée, planifiée ou dont le prompt est prêt, mais dont aucun rapport d'exécution validé n'a été reçu.
- **BLOQUÉE** : Tâche ne pouvant pas démarrer ou se poursuivre en raison d'un problème technique ou fonctionnel non résolu.

## Micro-tâches traitées

### 2.1.1 — Audit des variables d’environnement

- **Statut** : VALIDÉE
- Audit en lecture seule effectué.
- Aucun fichier modifié.
- État Git final propre.
- Variables et configurations existantes inventoriées.
- Validation applicative non exécutée car disproportionnée pour un audit documentaire.

### 2.1.1a — Premier complément de traçabilité

- **Statut** : NON VALIDÉE
- Motif exact : Le rapport ne fournissait pas réellement les numéros de ligne exigés dans les preuves, et aucune modification du dépôt n'avait été effectuée ; cette insuffisance a conduit à la correction 2.1.1b.

### 2.1.1b — Correction de la traçabilité

- **Statut** : VALIDÉE
- Constats C01 à C17 documentés.
- Preuves positives associées à des références `fichier:ligne`.
- Absence de lecture de `process.env`, `import.meta.env` ou `dotenv` dans `apps/api/src` confirmée.
- Valeurs sensibles masquées.
- Aucun fichier modifié.
- État Git final propre.

### 2.1.2 — Créer et tester un parseur pur de DATABASE_URL pour l’API

- **Statut** : VALIDÉE
- Fichiers créés :
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.test.ts`
- Contrat validé :
  - Parseur pur `parseDatabaseEnvironment(environment)` sans aucune lecture directe de `process.env`.
  - Acceptation des protocoles `postgres:` et `postgresql:`.
  - Refus des valeurs absentes, vides, composées uniquement d'espaces, URL syntaxiquement invalides ou utilisant d'autres protocoles.
  - Messages d'erreur explicites de type `EnvironmentValidationError` sans divulgation de l'URL sensible complète.
  - Suppression des espaces extérieurs de `databaseUrl`.
- Validations ciblées et globales réussies :
  - Validation ciblée : prettier, lint, typecheck, test, build sur `@local-market/api`.
  - Validation globale : `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Version TypeScript observée : `Version 7.0.2`.
- `dotenv`, `API_PORT`, Fastify et Kysely ne sont toujours pas intégrés.

### 2.1.3 — Créer et tester le parseur pur de API_PORT

- **Statut** : NON VALIDÉE
- Motif du rejet : La commande de lint ciblée `pnpm --filter @local-market/api lint` a échoué avec `sh: 1: eslint: not found`, mais les validations ont été poursuivies au lieu de stopper immédiatement selon le protocole. Le rejet concerne la procédure de validation et non un défaut de code identifié dans l'implémentation.
- Fichiers modifiés :
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.test.ts`
- Implémentation réalisée :
  - Parseur pur `parseApiPort(environment)` sans aucune lecture directe de `process.env`.
  - Exportation de l'interface `ApiPortEnvironment` (`apiPort: number`).
  - Refus des valeurs absentes, vides, composées uniquement d'espaces, non numériques, partiellement numériques, décimales, notations exponentielles, signes explicites, zéro, valeurs négatives ou supérieures à 65535.
  - Acceptation des bornes 1 et 65535 ainsi que de la valeur habituelle 3000.
  - Suppression des espaces extérieurs avant conversion.
  - Messages d'erreur explicites de type `EnvironmentValidationError` sans divulgation de la valeur brute reçue.
  - Maintien sans régression des tests de `DATABASE_URL` (9 tests) et ajout des tests Vitest pour `API_PORT` (17 tests, total 26 tests dans env.test.ts).

### 2.1.3a — Corriger la traçabilité et revalider le parseur API_PORT avec l’environnement ESLint isolé

- **Statut** : VALIDÉE
- Aucune modification de code ni de test effectuée pendant 2.1.3a (`env.ts` et `env.test.ts` inchangés).
- Fichiers modifiés :
  - `phase-2-avancement.md`
- Validation ciblée corrigée exécutée :
  - Prettier check : `pnpm exec prettier --check apps/api/src/config/env.ts apps/api/src/config/env.test.ts` (réussi).
  - ESLint ciblée via workspace isolé : `pnpm --filter @local-market/eslint-runtime exec eslint ../../apps/api/src/config/env.ts ../../apps/api/src/config/env.test.ts` (0 erreur, 0 avertissement).
  - Typecheck ciblée : `pnpm --filter @local-market/api typecheck` (réussi).
  - Test Vitest ciblé source : `pnpm --filter @local-market/api exec vitest run src/config/env.test.ts` (1 test file, 26 tests passés : 9 `parseDatabaseEnvironment`, 17 `parseApiPort`).
  - Test Vitest workspace api : `pnpm --filter @local-market/api test` (4 test files, 54 tests passés dont 26 sous src, 26 compilés sous dist, 1 src index test, 1 dist index test).
  - Build ciblé : `pnpm --filter @local-market/api build` (réussi).
- Validations globales réussies :
  - `pnpm exec tsc --version` (Version 7.0.2).
  - `pnpm format:check` (réussi).
  - `pnpm lint` (réussi).
  - `pnpm typecheck` (réussi).
  - `pnpm test` (réussi).
  - `pnpm build` (réussi).
- Avertissements réellement observés :
  - Avertissement Prettier pour `prettier.config.js` sans `"type": "module"`.
  - Avertissement pnpm pour les scripts de build ignorés (`esbuild@0.28.1`).
  - Avertissement Turborepo update (v2.10.5 ≫ v2.10.7).
- Version TypeScript observée : `Version 7.0.2`.
- `process.env`, `dotenv`, Fastify et Kysely ne sont toujours pas intégrés.

### 2.1.4 — Composer et tester le parseur pur de configuration API regroupant DATABASE_URL et API_PORT

- **Statut** : NON VALIDÉE
- Motif du rejet : Procédure de validation non conforme : absence du passage global préliminaire distinct avant modification du registre, absence des contrôles d'artefacts finaux (`git ls-files`), incohérence du nombre de tests inscrit dans le registre pour le workspace API, et formulation prématurément élargie de la tâche suivante. Aucun défaut de code n'a été identifié dans l'implémentation.
- Fichiers modifiés lors de 2.1.4 :
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.test.ts`
  - `phase-2-avancement.md`
- Implémentation réalisée pendant 2.1.4 :
  - Exportation de l'interface `ApiEnvironment` (étend `DatabaseEnvironment` et `ApiPortEnvironment`).
  - Parseur pur `parseApiEnvironment(environment: NodeJS.ProcessEnv): ApiEnvironment`.
  - Composition des parseurs existants `parseDatabaseEnvironment` et `parseApiPort` sans aucune duplication de logique de validation.
  - Ordre d'évaluation déterministe : `DATABASE_URL` puis `API_PORT`.
  - Forme de retour exacte : `{ databaseUrl: string, apiPort: number }`.
  - Propagation directe des erreurs `EnvironmentValidationError` sans masquage ni inclusion de valeurs brutes ou sensibles.
  - Non-mutation de l'objet d'environnement fourni.
  - Conservation des 26 tests existants et ajout de 13 tests Vitest dédiés (total 39 tests dans `env.test.ts`).

### 2.1.4a — Corriger la traçabilité et revalider la composition pure de la configuration API

- **Statut** : VALIDÉE
- Fichiers modifiés pendant 2.1.4a :
  - `phase-2-avancement.md` (`env.ts` et `env.test.ts` sont restés bit à bit inchangés, confirmés par SHA-256 identiques).
- Empreintes SHA-256 conservées :
  - `apps/api/src/config/env.ts` : `e63c7e0cf21fbb64c867838c1a27184ba97c4c67c0815fcb0e2bb5290083dbd7`
  - `apps/api/src/config/env.test.ts` : `2d96505543de726fd15e0869e39bdb046d7d8af5bacd598dd1348a08fe04a0cb`
- Revalidation documentaire et ciblée réussie :
  - Prettier check ciblé sur `env.ts` et `env.test.ts` (réussi).
  - Lint ESLint ciblé via l'environnement isolé `@local-market/eslint-runtime` (0 erreur, 0 avertissement).
  - Typecheck ciblé sur `@local-market/api` (réussi).
  - Vitest sur fichier source ciblé `src/config/env.test.ts` : 1 fichier de test, 39 tests passés (9 `parseDatabaseEnvironment`, 17 `parseApiPort`, 13 `parseApiEnvironment`).
  - Vitest sur workspace `@local-market/api` : 4 fichiers de test, 80 tests passés (39 source `src/config/env.test.ts`, 39 compilés `dist/config/env.test.js`, 1 source `src/index.test.ts`, 1 compilé `dist/index.test.js`).
  - Build ciblé `@local-market/api` (réussi).
- Passages globaux distincts exécutés :
  - Premier passage global préliminaire exécuté avant toute modification du registre (réussi).
  - Second passage global final exécuté après mise à jour du registre.
  - Version TypeScript observée sur les deux passages : `Version 7.0.2`.
- Contrôles d'artefacts exécutés :
  - `git ls-files ':(glob)**/dist/**'` : aucun artefact suivi.
  - `git ls-files ':(glob)**/.output/**'` : aucun artefact suivi.
  - `git ls-files ':(glob)**/.tanstack/**'` : aucun artefact suivi.
- Avertissements observés :
  - Avertissement Prettier pour `prettier.config.js` sans `"type": "module"`.
  - Avertissement pnpm pour les scripts de build ignorés (`esbuild@0.28.1`).
  - Avertissement Turborepo update (v2.10.5 ≫ v2.10.7).
  - Doublons de tests compilés observés sous `dist` dans Vitest (distingues des 39 tests source).
- `process.env`, `dotenv`, Fastify et Kysely ne sont toujours pas intégrés.

### 2.1.5 — Créer et tester l’adaptateur de chargement de la configuration API depuis process.env

- **Statut** : VALIDÉE
- Fichiers modifiés :
  - `apps/api/src/config/env.ts`
  - `apps/api/src/config/env.test.ts`
  - `phase-2-avancement.md`
- Implémentation réalisée :
  - Exportation de `loadApiEnvironment(): ApiEnvironment`.
  - Adaptateur minimal qui appelle `parseApiEnvironment(process.env)` et retourne son résultat.
  - Conservation de toutes les validations, normalisations et erreurs existantes.
  - Lecture dynamique de l'état courant de `process.env` à chaque appel sans cache.
  - Aucun chargement de `dotenv`.
  - Aucune journalisation des variables ni de leurs valeurs.
  - Aucune modification de `process.env`.
  - Non-intégration à Fastify ou au démarrage de l'API.
  - Maintien sans régression des 39 tests source existants et ajout de 5 tests Vitest ciblés (total 44 tests source dans `env.test.ts`).
- Validations ciblées et globales réussies :
  - Prettier check ciblé sur `env.ts` et `env.test.ts` (réussi après formatage).
  - ESLint ciblé via l'environnement isolé `@local-market/eslint-runtime` (0 erreur, 0 avertissement).
  - Typecheck ciblé sur `@local-market/api` (réussi).
  - Vitest sur fichier source ciblé `src/config/env.test.ts` : 1 fichier de test, 44 tests passés (9 `parseDatabaseEnvironment`, 17 `parseApiPort`, 13 `parseApiEnvironment`, 5 `loadApiEnvironment`).
  - Vitest sur workspace `@local-market/api` : 4 fichiers de test, 85 tests passés (44 source `src/config/env.test.ts`, 39 compilés `dist/config/env.test.js`, 1 source `src/index.test.ts`, 1 compilé `dist/index.test.js`).
  - Build ciblé `@local-market/api` (réussi).
  - Passage global final : `tsc --version` (Version 7.0.2), `format:check`, `lint`, `typecheck`, `test`, `build` tous réussis.
- Contrôles d'artefacts exécutés :
  - `git ls-files ':(glob)**/dist/**'` : aucun artefact suivi.
  - `git ls-files ':(glob)**/.output/**'` : aucun artefact suivi.
  - `git ls-files ':(glob)**/.tanstack/**'` : aucun artefact suivi.
- Version TypeScript observée : `Version 7.0.2`.
- `dotenv`, Fastify et Kysely ne sont toujours pas intégrés.

## Constats et décisions établis

### Faits et constats validés

- `DATABASE_URL` existe dans `.env` et `.env.example`.
- `API_PORT` existe dans `.env` et `.env.example`.
- Docker Compose configure PostgreSQL avec des variables `POSTGRES_*`.
- Docker Compose injecte `DATABASE_URL` dans l'API et le worker.
- Le contexte local et le réseau Docker utilisent des hôtes différents.
- La convention applicative observée est une URL de connexion unique `DATABASE_URL`.
- Les formes `postgres:` et `postgresql:` sont présentes dans la configuration actuelle.
- Le port et l'hôte Fastify sont actuellement codés en dur.
- L'API ne lit encore aucune variable d'environnement.
- `dotenv`, `kysely`, `pg` et `@types/pg` sont déjà déclarés dans le projet.
- Les scripts `db:migrate`, `db:rollback`, `db:status` et `db:seed` sont déjà déclarés.
- Aucune connexion PostgreSQL/Kysely n'est encore implémentée.

### Décisions pour la prochaine implémentation (non encore créées)

- Commencer par un parseur pur de `DATABASE_URL`.
- Accepter les schémas `postgres:` et `postgresql:`.
- Ne pas charger `dotenv` ni intégrer `process.env` pendant cette première implémentation.
- Valider `API_PORT` dans une micro-tâche distincte.

## Micro-tâche suivante immédiate

La détermination de la micro-tâche suivante attend l'analyse du présent rapport.

## Blocages et avertissements

- Aucun blocage actuel.
- Le binaire `rg` n'était pas disponible dans le PATH standard lors du dernier audit et a été trouvé dans l'environnement VS Code.
- Ne jamais inscrire de valeur provenant de `.env` ou d'une URL de connexion.

## Règles de mise à jour

Après chaque rapport Gemini analysé, ce registre doit être actualisé pour conserver :

- L'identifiant et l'objectif de la micro-tâche ;
- Son statut réel ;
- Les fichiers modifiés ;
- Les validations exécutées et leurs résultats ;
- Les échecs et avertissements ;
- L'état Git final ;
- La prochaine micro-tâche immédiate uniquement.

Une mise à jour ne doit jamais annoncer une tâche suivante comme commencée ou validée sans rapport correspondant.
