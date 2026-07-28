# Phase 2 — Avancement

Ce registre constitue le point de reprise persistant de la Phase 2 du projet.

Principes de gouvernance :

- `phase-2.md` reste la source de vérité du périmètre applicatif et technique.
- `AGENTS.md` reste la source de vérité des règles de travail et d'exécution.
- Une tâche est considérée comme VALIDÉE uniquement si son rapport confirme l'ensemble des validations exigées.
- Un prompt préparé ou transmitted n'est pas une tâche terminée.
- Une tâche échouée ou partiellement validée ne permet pas de poursuivre comme si elle avait réussi.
- Aucune valeur secrète (mot de passe, jeton, URL de connexion complète) ne doit être inscrite dans ce registre.

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

### 2.1.2 — Créer et tester un parseur pur de DATABASE_URL pour l’API.

- **Statut** : À FAIRE
- Prompt déjà préparé.
- Aucune exécution ni modification reçue.
- Fichiers envisagés : `apps/api/src/config/env.ts` et `apps/api/src/config/env.test.ts`.
- Cette entrée ne doit pas être marquée VALIDÉE avant réception et analyse du rapport Gemini.

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
