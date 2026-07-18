# Phase 2 — Base de données, API publique et découverte des exploitations

## Statut

**État : à démarrer après validation complète de la Phase 1.**

## Objectif de la phase

Construire la première tranche métier complète :

```text
Storefront
→ client TypeScript généré
→ API Fastify
→ Kysely
→ PostgreSQL / PostGIS
```

À la fin de la Phase 2, un utilisateur doit pouvoir saisir ou fournir une position, rechercher des exploitations proches et consulter leurs produits réellement stockés en base.

## Résultat utilisateur attendu

Depuis le storefront, un visiteur pourra :

- saisir une latitude et une longitude ou utiliser une position de test ;
- choisir un rayon de recherche ;
- afficher les exploitations proches ;
- voir leur distance ;
- ouvrir la fiche d'une exploitation ;
- consulter ses produits disponibles.

Cette phase ne contient pas encore le panier ni le paiement.

## Architecture cible

```text
┌──────────────────────┐
│ Storefront           │
│ TanStack Start       │
└──────────┬───────────┘
           │ client OpenAPI généré
           ▼
┌──────────────────────┐
│ API Fastify          │
│ TypeBox + OpenAPI    │
└──────────┬───────────┘
           │ Kysely
           ▼
┌──────────────────────┐
│ PostgreSQL + PostGIS │
└──────────────────────┘
```

## Technologies ajoutées

- Kysely ;
- pilote PostgreSQL `pg` ;
- TypeBox pour les schémas d'entrée et de sortie ;
- génération OpenAPI ;
- client TypeScript généré ;
- tests d'intégration sur PostgreSQL/PostGIS réel.

## Modèle de données initial

### `users`

Représente les futurs comptes clients, agriculteurs et administrateurs.

Champs principaux :

```text
id
email
password_hash
display_name
email_verified_at
created_at
updated_at
```

### `farms`

Représente une exploitation agricole.

```text
id
name
slug
description
public_email
public_phone
is_active
created_at
updated_at
```

### `farm_members`

Relie un utilisateur à une exploitation.

Rôles :

```text
owner
manager
staff
```

### `farm_locations`

Adresse et position géographique publique.

```text
id
farm_id
address_line1
address_line2
postal_code
city
country_code
location geography(Point, 4326)
pickup_instructions
is_public
created_at
updated_at
```

Index obligatoire :

```text
GiST sur location
```

### `product_catalog`

Produit générique indépendant d'un agriculteur.

Exemples :

- tomate ;
- pomme ;
- carotte ;
- courgette ;
- fraise ;
- pomme de terre.

Catégories initiales :

```text
fruit
vegetable
herb
other
```

### `listings`

Offre commerciale d'un agriculteur.

```text
id
farm_id
product_catalog_id
title
description
variety
unit
unit_quantity
price_cents
currency
vat_rate
is_active
created_at
updated_at
```

Unités initiales :

```text
piece
kilogram
gram
bunch
box
basket
```

### `inventory_batches`

Première représentation du stock disponible.

```text
id
listing_id
available_quantity
reserved_quantity
harvested_at
expires_at
created_at
updated_at
```

Contraintes :

```text
available_quantity >= 0
reserved_quantity >= 0
```

Les mouvements de stock détaillés seront ajoutés en Phase 3.

## Stratégie monétaire et décimale

- les prix sont stockés en centimes entiers ;
- les quantités sont stockées en `numeric` PostgreSQL ;
- aucun prix ne doit utiliser un flottant JavaScript ;
- la stratégie de conversion des `numeric` doit être documentée ;
- les types Kysely restent internes à l'API.

## Migrations

Les migrations Kysely deviennent la source de vérité du schéma.

Convention :

```text
YYYY-MM-DDTHHmmss_description.ts
```

Commandes à créer :

```bash
pnpm db:migration:create <name>
pnpm db:migrate
pnpm db:rollback
pnpm db:status
pnpm db:seed
pnpm db:reset
```

Règles :

- migrations autonomes ;
- fonctions `up` et `down` ;
- aucun import de modèle applicatif évolutif ;
- reset interdit en production ;
- migration testée sur une base vide ;
- rollback de la dernière migration vérifié.

## Extensions PostgreSQL

Première migration :

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Le rollback ne doit pas supprimer imprudemment une extension partagée.

## Seed de développement

Le seed doit être idempotent et créer :

- deux utilisateurs agriculteurs ;
- deux exploitations ;
- deux positions françaises distinctes ;
- plusieurs produits ;
- plusieurs offres actives ;
- une offre inactive ;
- une offre sans stock ;
- plusieurs lots disponibles.

Le seed doit pouvoir être rejoué sans duplication.

## Organisation de l'API

Structure recommandée :

```text
apps/api/src/
├── config/
├── database/
│   ├── connection.ts
│   ├── database.ts
│   ├── database.types.ts
│   ├── migrate.ts
│   ├── rollback.ts
│   ├── migration-status.ts
│   ├── seed.ts
│   └── migrations/
│
├── modules/
│   ├── health/
│   ├── farms/
│   ├── catalog/
│   └── listings/
│
├── app.ts
└── server.ts
```

Séparer impérativement :

```text
buildApp()
startServer()
```

`buildApp()` doit accepter des dépendances injectées pour les tests.

## Routes de santé

### `GET /health`

Vérifie uniquement que le processus HTTP fonctionne.

```json
{
  "status": "ok"
}
```

### `GET /ready`

Vérifie :

- connexion PostgreSQL ;
- requête simple ;
- disponibilité de PostGIS.

```json
{
  "status": "ready",
  "database": "ok",
  "postgis": "ok"
}
```

## API publique

### `GET /v1/farms/nearby`

Paramètres :

```text
latitude
longitude
radiusKm
category
availableOnly
limit
cursor
```

Validations :

```text
latitude : -90 à 90
longitude : -180 à 180
radiusKm : > 0 et <= 100
limit : 1 à 50
```

Valeurs par défaut :

```text
radiusKm = 20
availableOnly = true
limit = 20
```

La requête doit :

- utiliser `ST_DWithin` ;
- calculer la distance en base ;
- trier par distance croissante ;
- exclure les fermes inactives ;
- exclure les localisations non publiques ;
- éviter les doublons ;
- filtrer par catégorie ;
- filtrer par disponibilité ;
- éviter les requêtes N+1.

### `GET /v1/farms/:farmId`

Retourne uniquement les informations publiques d'une exploitation active.

### `GET /v1/farms/:farmId/listings`

Retourne :

- offres actives ;
- stock disponible calculé ;
- informations du catalogue ;
- aucun champ administratif.

## Requête PostGIS

Structure attendue :

```sql
ST_DWithin(
  location,
  ST_SetSRID(
    ST_MakePoint(longitude, latitude),
    4326
  )::geography,
  radius_in_meters
)
```

Attention à l'ordre :

```text
longitude, latitude
```

Le plan d'exécution doit être inspecté pour vérifier l'utilisation possible de l'index spatial.

## Validation HTTP

Toutes les entrées et sorties utilisent TypeBox.

Format d'erreur cohérent :

```json
{
  "type": "https://local-market.test/problems/validation-error",
  "title": "Requête invalide",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "detail": "Les paramètres fournis sont invalides.",
  "requestId": "request-id",
  "errors": []
}
```

Codes initiaux :

```text
VALIDATION_ERROR
INTERNAL_ERROR
DATABASE_UNAVAILABLE
FARM_NOT_FOUND
LISTING_NOT_FOUND
```

## OpenAPI

Le document OpenAPI doit être produit depuis les schémas Fastify/TypeBox.

Commande :

```bash
pnpm api:openapi
```

Livrable :

```text
apps/api/openapi/openapi.json
```

Le résultat doit être déterministe.

Swagger UI peut être disponible uniquement en développement ou derrière une configuration explicite.

## Client TypeScript généré

Flux :

```text
TypeBox
→ OpenAPI
→ packages/api-client/src/generated
→ storefront, admin, mobile
```

Commandes :

```bash
pnpm api:client:generate
pnpm api:client:check
```

Le package doit fournir :

- types générés ;
- constructeur de client ;
- base URL configurable ;
- gestion normalisée des erreurs ;
- prise en charge des headers ;
- aucun secret ;
- aucun type Kysely.

Les fichiers générés ne doivent jamais être modifiés manuellement.

## Première intégration storefront

Créer une page simple avec :

- latitude ;
- longitude ;
- rayon ;
- bouton de recherche ;
- liste des exploitations ;
- distance ;
- état de chargement ;
- erreur ;
- aucun résultat.

Aucun design final n'est requis.

Le but est de prouver la chaîne complète.

## Tests obligatoires

### Migrations

- migration sur base vide ;
- statut ;
- seed ;
- lecture ;
- rollback ;
- remigration ;
- seed rejoué sans doublon.

### API

- `/health` retourne 200 ;
- `/ready` retourne 200 avec base disponible ;
- `/ready` échoue proprement sans base ;
- ferme dans le rayon incluse ;
- ferme hors rayon exclue ;
- tri par distance ;
- ferme inactive exclue ;
- position non publique exclue ;
- catégorie filtrée ;
- offre sans stock filtrée si demandé ;
- coordonnées invalides rejetées ;
- rayon trop grand rejeté ;
- données privées non exposées.

### Client généré

- paramètres correctement typés ;
- réponse inférée ;
- compilation du client.

### Storefront

- recherche sur données du seed ;
- affichage d'au moins une exploitation ;
- gestion de l'absence de résultat ;
- gestion d'une erreur API.

## Docker

Les migrations restent une commande explicite :

```bash
docker compose run --rm api pnpm db:migrate
```

Ne pas lancer les migrations automatiquement dans chaque réplique de l'API.

## Hors périmètre de la Phase 2

Ne pas développer :

- authentification complète ;
- back-office fonctionnel ;
- panier ;
- réservation de stock ;
- commande ;
- Stripe ;
- e-mails métier ;
- application mobile fonctionnelle ;
- livraison ;
- panier multi-agriculteurs.

## Ordre recommandé des micro-tâches

1. configuration et validation des variables d'environnement ;
2. connexion PostgreSQL avec Kysely ;
3. runner de migrations ;
4. extensions PostgreSQL ;
5. tables utilisateurs et exploitations ;
6. catalogue, offres et lots de stock ;
7. seed ;
8. plugin Fastify de base de données ;
9. route `/ready` ;
10. requête PostGIS ;
11. routes publiques ;
12. gestion des erreurs ;
13. OpenAPI ;
14. client TypeScript ;
15. intégration storefront ;
16. tests d'intégration ;
17. audit final Phase 2.

Chaque micro-tâche doit être validée avant la suivante.

## Critères d'acceptation

La Phase 2 est terminée lorsque :

- Kysely accède à PostgreSQL ;
- les migrations fonctionnent sur une base vide ;
- le rollback fonctionne ;
- le seed est idempotent ;
- PostGIS est actif ;
- la recherche par distance est correcte ;
- les routes publiques sont validées par TypeBox ;
- OpenAPI est généré ;
- le client TypeScript est généré ;
- le storefront utilise ce client ;
- les tests PostgreSQL/PostGIS passent ;
- Docker démarre l'environnement ;
- le dépôt reste propre après les builds ;
- la documentation est à jour.

## Livrables

- schéma initial ;
- migrations ;
- seed ;
- API publique ;
- recherche géographique ;
- OpenAPI ;
- client TypeScript partagé ;
- page de recherche storefront ;
- tests d'intégration ;
- documentation de base de données et d'API.

## Verdict attendu

```text
PHASE 2 VALIDÉE
```
