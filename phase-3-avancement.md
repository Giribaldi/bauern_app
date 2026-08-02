# Phase 3 — Avancement

## Statut

**État : IMPLÉMENTATION AVANCÉE, NON VALIDÉE.**

La mention `PHASE 3 VALIDÉE` ne peut pas encore être prononcée. Le test PostgreSQL/PostGIS réel et les deux parcours E2E Chromium passent. Les images Docker ont été construites avant le dernier correctif du worker ; cette image et son maintien en fonctionnement doivent être revalidés. Le parcours Expo doit encore être vérifié sur simulateur ou appareil et le paiement Stripe doit être vérifié avec de vraies clés de test.

## Point de reprise

- Les deux E2E Chromium passent : storefront invité et back-office admin.
- Les défauts révélés par les premiers passages E2E ont été corrigés : soumission avant hydratation, hash du mot de passe seed non actualisé, jeton invité perdu pendant la redirection, formulaire admin réinitialisé après un traitement asynchrone et sélecteur Playwright ambigu.
- Le contrôle Docker final a montré que le worker quittait après son premier cycle, car son intervalle était détaché avec `unref()`. Le correctif est présent dans `apps/worker/src/index.ts` et ses typecheck, tests et build ciblés passent.
- L’image Docker du worker n’a pas encore été reconstruite après ce dernier correctif et le conteneur observé reste arrêté. Reprendre par la reconstruction de l’image, la recréation du service et la vérification qu’il reste actif pendant plusieurs cycles.
- Les contrôles globaux ont réussi avant le dernier correctif du worker. Ils doivent être rejoués après sa validation Docker.

## Phase 3A — Authentification, back-office et stock

### Réalisé

- Migration `sessions`, `login_attempts`, `stock_movements` et journal d’audit administratif.
- Mots de passe Argon2id avec l’implémentation native de Node.js 24.
- Sessions opaques révocables, jetons SHA-256 en base, expiration et cookie HTTP-only/SameSite/Secure en production.
- Limitation persistante des tentatives de connexion.
- Routes login, logout et session.
- Autorisation systématique par adhésion à l’exploitation et rôle.
- Routes admin pour exploitations, offres, inventaire, historique et commandes.
- Verrouillage de ligne et transaction pour chaque mouvement de stock.
- Motif obligatoire pour une correction et contraintes empêchant un stock négatif.
- Interface admin : connexion, sélection d’exploitation, offres, stock, historique et liste de commandes.
- Seed local authentifiable documenté dans le README.

### Validé automatiquement

- Hash et vérification Argon2id.
- Connexion invalide puis valide sur PostgreSQL réel.
- Session récupérable.
- Un membre de la première ferme ne peut pas modifier la seconde.
- Ajout de stock, refus d’une correction sans motif et historique du mouvement.

## Phase 3B — Panier, commande invitée et paiement

### Réalisé

- Migration des paniers, lignes de panier, commandes, snapshots, réservations, paiements, événements, accès invité et tâches e-mail.
- Identifiant de panier opaque et hashé, expiration, devise EUR et exploitation unique.
- Prix recalculés depuis les offres côté API.
- Checkout idempotent avec transaction sérialisable, verrouillage des lots et réservations de 15 minutes.
- Snapshots immuables des lignes de commande.
- Jeton invité aléatoire stocké sous forme hashée et route de suivi.
- Abstraction `PaymentProvider`, implémentation Stripe Checkout par API HTTP et faux prestataire local.
- Signature Stripe HMAC, fenêtre temporelle, événements idempotents et consommation/libération atomique des réservations.
- Worker PostgreSQL avec `FOR UPDATE SKIP LOCKED`, libération des réservations et reprise des e-mails SMTP/Mailpit.
- Storefront : recherche, ferme, produits, panier, checkout et suivi invité.
- Routes de préparation du rattachement futur d’une commande ; aucune commande n’est rattachée sur la seule adresse e-mail.

### Validé automatiquement

- Refus du panier multi-fermes avec `MULTI_FARM_CART_NOT_ALLOWED`.
- Création de commande invitée et conservation du prix snapshot.
- Accès avec le bon jeton invité.
- Rejeu du même webhook sans seconde vente.
- Test critique réel : deux checkouts simultanés avec un stock de 1, une seule réservation réussit et le stock reste non négatif.
- Migration appliquée et seed exécuté dans le conteneur API.

### À valider avec services externes

- Stripe Checkout en mode test avec de vraies clés et un webhook Stripe CLI.
- Réception visuelle dans Mailpit des quatre modèles d’e-mail.

## Phase 3C — Mobile, E2E et déploiement

### Réalisé

- Parcours Expo : consentement de localisation, recherche, ferme, produits, panier, navigateur de paiement, deep link et suivi réel via l’API.
- Utilisation du client API partagé et de composants React Native uniquement.
- Headers de sécurité, CORS avec liste d’origines, limite de payload, request ID, erreurs centralisées, readiness et arrêt propre.
- Contrat de stockage objet compatible S3 et validation des URL publiques HTTPS.
- Tests Playwright storefront et admin dans `tests/e2e/phase-3.spec.ts`.
- Documentation de production, secrets, déploiement, supervision, sauvegarde et restauration.
- Quatre images serveur indépendantes construites et stack Compose saine.

### Validation navigateur

Commande :

```bash
pnpm exec playwright install chromium
pnpm e2e
```

Après installation des dépendances Chromium par l’utilisateur, les deux scénarios ont réellement été exécutés. Les premiers passages ont révélé et permis de corriger l’interaction avant hydratation, le hash du mot de passe seed non actualisé, la conservation du jeton invité lors de la redirection et la réinitialisation asynchrone du formulaire admin.

Résultat final : `pnpm e2e` → 2 tests passés sous Chromium (storefront et admin).

### À valider manuellement

- Le parcours Expo doit passer sur simulateur ou appareil, notamment permission réelle, ouverture du navigateur et retour deep link.
- Une restauration de sauvegarde PostgreSQL doit être exécutée sur une base isolée avant production.

## Commandes exécutées et résultats

### Réussies

- `pnpm install --frozen-lockfile`.
- `pnpm exec tsc --version` → `Version 7.0.2`.
- Typechecks ciblés API, client, admin, storefront, mobile et worker.
- Tests ciblés API, admin, storefront et worker.
- Builds ciblés API, client, admin, storefront, worker et typecheck Expo.
- `RUN_DATABASE_INTEGRATION=1 pnpm --filter @local-market/api exec vitest run src/database/database.integration.test.ts` → 1 test réel passé.
- `pnpm api:openapi`.
- Deux générations consécutives du client, SHA-256 identique : `04e43f13c520c66b6314dbad39966055e03b1c5b7ea10c0ff27c52de5199fefb`.
- `docker compose config` et `docker compose config --services`.
- Construction des images API, worker, storefront et admin avec le builder classique (`buildx` absent).
- `docker compose run --rm api pnpm db:migrate`.
- `docker compose run --rm api pnpm db:seed`.
- `docker compose up -d`, `/health`, `/ready`, storefront et admin accessibles ; six services actifs, services HTTP sains.
- `pnpm e2e` → 2 tests Chromium passés : parcours storefront invité et parcours admin.
- Après le correctif de maintien en vie du worker : typecheck, 2 tests et build ciblés réussis.
- `pnpm format:check`, `pnpm typecheck`, `pnpm test` et `pnpm build` lors du premier passage global.

### Échouées puis corrigées

- Premier lint global : deux imports inutilisés. Ils ont été supprimés, puis le lint global final a réussi.
- Premier `docker compose build` : plugin `docker-buildx` absent. Les quatre images ont été construites avec `DOCKER_BUILDKIT=0`.
- Premiers lancements E2E : dépendances Chromium absentes, puis défauts d’hydratation et sélecteurs trop larges. Les dépendances ont été installées par l’utilisateur, les défauts applicatifs corrigés et le passage final a réussi.

### Échouées ou non exécutées

- `pnpm api:client:check` ne peut pas être utilisé comme validation d’un client volontairement modifié avant commit ; la reproductibilité a été contrôlée par deux générations et deux empreintes identiques.
- Test Expo sur simulateur/appareil : non exécuté.
- Stripe test réel : non exécuté, secrets absents.
- Test réel de restauration : non exécuté.
- Reconstruction de l’image Docker du worker corrigé : non exécutée, autorisation de commande interrompue. Le dernier conteneur observé était `Exited (0)`.

## Avertissements

- Avertissement Node `MODULE_TYPELESS_PACKAGE_JSON` pour `prettier.config.js` et certains modules compilés.
- Scripts de build `esbuild@0.28.1` ignorés par pnpm, avertissement déjà présent dans l’environnement.
- Peer dependency Expo/Remix demandant TypeScript 5 alors que le projet impose TypeScript 7.0.2.
- Le builder Docker classique est déprécié ; installer `docker-buildx` sur la machine de CI.
- Le faux prestataire de paiement est utilisé hors production en l’absence de secrets Stripe ; le démarrage de production refuse ces secrets absents.

## Condition de clôture

Après réussite du smoke test Expo, du flux Stripe test et du test de restauration, refaire les contrôles globaux et Git. Seulement alors remplacer le statut par `PHASE 3 VALIDÉE`.

## Dernière validation globale

Avant le dernier correctif du worker : `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` et `pnpm e2e` ont tous réussi. TypeScript observé : `Version 7.0.2`. Aucun fichier sous `dist`, `.output` ou `.tanstack` n’est suivi par Git. Après le correctif, les contrôles ciblés du worker passent, mais la validation Docker du worker et le passage global complet restent à refaire.
