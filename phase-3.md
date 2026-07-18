# Phase 3 — Commerce MVP complet, back-office et application mobile

## Statut

**État : à démarrer après validation complète de la Phase 2.**

## Objectif de la phase

Transformer la base technique et l'API publique en un MVP commercial utilisable :

- un agriculteur se connecte ;
- il gère ses offres et son stock ;
- un client recherche une ferme ;
- il ajoute des produits au panier ;
- il commande sans compte ;
- il paie ;
- il suit sa commande ;
- l'agriculteur prépare et finalise la commande ;
- le même parcours principal est disponible dans l'application Expo.

## Principe de simplicité du MVP

Pour réduire les risques métier et techniques :

- une commande contient les produits d'une seule exploitation ;
- retrait à la ferme uniquement ;
- pas de livraison ;
- pas de panier multi-agriculteurs ;
- pas de partage automatique du paiement ;
- pas de notation ;
- pas d'abonnement ;
- pas de promotion avancée.

## Architecture cible

```text
Storefront ─┐
Admin ──────┼──► API Fastify ───► PostgreSQL / PostGIS
Mobile ─────┘          │
                       ├──► Prestataire de paiement
                       ├──► E-mails
                       └──► Worker
```

## Découpage interne recommandé

La Phase 3 doit être exécutée en trois sous-phases.

### Phase 3A — Authentification, back-office et stock

### Phase 3B — Panier, commande invitée et paiement

### Phase 3C — Mobile, tests end-to-end et préparation au déploiement

Ne jamais lancer les trois sous-phases en parallèle avec un agent unique.

---

# Phase 3A — Authentification, back-office et stock

## Authentification

Exigences :

- Argon2id pour les mots de passe ;
- sessions opaques révocables ;
- jetons de session stockés sous forme hashée ;
- cookie HTTP-only sécurisé ;
- durée configurable ;
- limitation des tentatives de connexion ;
- séparation authentification et autorisation.

Routes initiales :

```text
POST /v1/auth/login
POST /v1/auth/logout
GET  /v1/auth/session
```

## Autorisation par exploitation

Table :

```text
farm_members
```

Chaque requête administrative doit vérifier :

- utilisateur authentifié ;
- appartenance à l'exploitation ;
- rôle suffisant.

Ne jamais faire confiance au `farmId` envoyé par le navigateur.

## Back-office

Pages :

- connexion ;
- tableau de bord ;
- sélection d'exploitation ;
- profil public ;
- liste des offres ;
- création d'offre ;
- modification d'offre ;
- activation/désactivation ;
- gestion du stock ;
- historique de stock ;
- liste des commandes ;
- détail d'une commande ;
- changement de statut.

## Stock détaillé

Ajouter :

```text
stock_movements
stock_reservations
```

Types de mouvements :

```text
stock_added
stock_corrected
stock_reserved
reservation_released
stock_sold
stock_refunded
stock_lost
```

Toute modification de stock produit un mouvement immuable.

Les corrections manuelles doivent exiger une raison.

## Contraintes de stock

Toujours garantir :

```text
available_quantity >= 0
reserved_quantity >= 0
```

Les opérations concurrentes doivent utiliser :

- transaction ;
- verrouillage de lignes ;
- vérification des quantités ;
- mouvement d'audit.

## Routes administratives

```text
GET    /v1/admin/farms
GET    /v1/admin/farms/:farmId
PATCH  /v1/admin/farms/:farmId

GET    /v1/admin/farms/:farmId/listings
POST   /v1/admin/farms/:farmId/listings
GET    /v1/admin/farms/:farmId/listings/:listingId
PATCH  /v1/admin/farms/:farmId/listings/:listingId

GET    /v1/admin/farms/:farmId/inventory
POST   /v1/admin/farms/:farmId/inventory/movements
```

## Tests 3A

- connexion réussie et échouée ;
- session expirée ;
- utilisateur sans exploitation refusé ;
- membre d'une ferme ne peut pas modifier une autre ferme ;
- création d'offre ;
- modification du prix ;
- ajout de stock ;
- correction avec motif ;
- quantité négative impossible ;
- historique complet.

---

# Phase 3B — Panier, commande invitée et paiement

## Panier

Tables :

```text
carts
cart_items
```

Contraintes :

- identifiant opaque ;
- expiration ;
- devise unique ;
- exploitation unique ;
- prix toujours recalculé côté serveur.

Routes :

```text
POST   /v1/carts
GET    /v1/carts/:cartId
POST   /v1/carts/:cartId/items
PATCH  /v1/carts/:cartId/items/:itemId
DELETE /v1/carts/:cartId/items/:itemId
```

Erreur métier :

```text
MULTI_FARM_CART_NOT_ALLOWED
```

## Réservation

Au checkout :

1. valider le panier ;
2. recalculer les prix ;
3. ouvrir une transaction ;
4. verrouiller les lots ;
5. vérifier le stock ;
6. créer les réservations ;
7. incrémenter le stock réservé ;
8. créer la commande ;
9. créer les mouvements ;
10. valider la transaction.

Durée par défaut :

```text
15 minutes
```

## Commandes

Tables :

```text
orders
order_items
payments
payment_events
guest_order_access
```

Statuts :

```text
pending_payment
paid
preparing
ready_for_pickup
completed
cancelled
refunded
```

Les lignes de commande sont des snapshots immuables :

- nom du produit ;
- nom de la ferme ;
- variété ;
- unité ;
- prix ;
- TVA ;
- quantité ;
- total.

## Commande sans compte

Le client fournit une adresse e-mail.

Créer :

- commande sans `user_id` ;
- jeton aléatoire ;
- hash du jeton en base ;
- lien de suivi sécurisé ;
- expiration ou révocation si nécessaire.

Route publique :

```text
GET /v1/guest-orders/:token
```

Préparer le futur rattachement :

```text
POST /v1/order-claims/request
POST /v1/order-claims/confirm
```

Ne jamais rattacher une commande sur la seule base d'une adresse e-mail non vérifiée.

## Paiement

Utiliser une abstraction :

```ts
interface PaymentProvider {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedPaymentEvent>
}
```

Le métier ne dépend pas directement des types du prestataire.

Implémentation MVP :

```text
Stripe Checkout en mode test
```

Routes :

```text
POST /v1/checkout
POST /v1/webhooks/stripe
```

## Webhook

Le webhook est la seule confirmation fiable du paiement.

Exigences :

- signature vérifiée ;
- événement idempotent ;
- commande retrouvée ;
- réservations consommées ;
- stock vendu ;
- mouvements enregistrés ;
- état `paid`.

En cas d'expiration :

- libération de réservation ;
- stock rendu disponible ;
- mouvement enregistré ;
- commande annulée ou expirée.

## Worker

Responsabilités :

- libérer les réservations expirées ;
- envoyer les e-mails ;
- reprendre les tâches en cas d'échec ;
- éviter le double traitement.

Pour le MVP, PostgreSQL peut servir de source de vérité sans Redis.

## E-mails

Avec Mailpit en développement :

- confirmation de commande ;
- lien de suivi ;
- commande prête ;
- annulation.

Ne jamais journaliser le lien complet de production.

## Tests 3B

- panier mono-ferme ;
- refus d'un second agriculteur ;
- prix recalculé ;
- concurrence sur le dernier article ;
- stock jamais négatif ;
- réservation expirée ;
- double clic checkout idempotent ;
- webhook rejoué sans double vente ;
- mauvais jeton invité refusé ;
- bon jeton autorisé ;
- snapshot historique conservé.

Le test critique :

```text
Deux checkouts simultanés
Stock disponible = 1
Résultat : une seule commande peut réserver le produit
```

---

# Phase 3C — Application mobile, E2E et déploiement

## Application Expo

Écrans :

- autorisation de localisation ;
- recherche ;
- liste des fermes ;
- fiche ferme ;
- produits ;
- panier ;
- checkout ;
- retour par deep link ;
- suivi de commande.

Réutiliser :

- client OpenAPI ;
- types ;
- codes d'erreur ;
- fonctions utilitaires ;
- TanStack Query.

Ne pas partager directement les composants DOM avec React Native.

## Paiement mobile

Flux :

1. création du checkout via API ;
2. ouverture de la page de paiement dans le navigateur système ;
3. retour vers l'application par deep link ;
4. consultation du statut réel depuis l'API.

Le retour dans l'application ne confirme jamais le paiement à lui seul.

## Tests end-to-end

### Storefront

- recherche ;
- fiche ferme ;
- panier ;
- checkout test ;
- confirmation ;
- suivi invité.

### Admin

- connexion ;
- création d'offre ;
- ajout de stock ;
- vérification dans le storefront ;
- commande ;
- changement de statut.

### Mobile

- parcours principal sur simulateur ou appareil ;
- deep link ;
- suivi de commande.

## Sécurité et observabilité

Ajouter :

- logs structurés ;
- request ID ;
- durées ;
- erreurs centralisées ;
- limitation de débit ;
- headers de sécurité ;
- CORS ;
- taille maximale des payloads ;
- audit administratif ;
- arrêt propre ;
- endpoints `/health` et `/ready`.

Ne jamais journaliser :

- mot de passe ;
- cookie ;
- jeton complet ;
- signature complète ;
- secret Stripe ;
- données de carte.

## Images

Préparer une abstraction S3 compatible :

```text
S3
Cloudflare R2
Scaleway
MinIO en local
```

Pour le MVP initial, une URL validée peut être acceptée si l'upload n'est pas encore prioritaire.

## Déploiement

Images indépendantes :

```text
local-market-api
local-market-worker
local-market-storefront
local-market-admin
```

Le mobile est distribué via l'écosystème Expo et les stores, pas exécuté sur le VPS.

Déploiement recommandé :

```text
Caddy ou Traefik
API
Storefront
Admin
Worker
PostgreSQL/PostGIS
Stockage objet
```

Sous-domaines :

```text
www.exemple.fr
admin.exemple.fr
api.exemple.fr
```

## Sauvegardes

Avant production :

- sauvegarde PostgreSQL automatisée ;
- test de restauration ;
- conservation adaptée ;
- secrets hors Git ;
- rotation des secrets ;
- migrations exécutées comme étape dédiée.

## Hors périmètre du MVP

À conserver pour plus tard :

- panier multi-agriculteurs ;
- livraison ;
- marketplace de paiement avancée ;
- commissions automatiques ;
- abonnements ;
- avis ;
- promotions complexes ;
- prévision de stock ;
- carte géographique avancée.

## Ordre recommandé des micro-tâches

### 3A

1. migration sessions ;
2. hash des mots de passe ;
3. login/logout/session ;
4. autorisation par ferme ;
5. CRUD offres ;
6. mouvements de stock ;
7. UI admin ;
8. tests d'isolation.

### 3B

1. migrations paniers ;
2. service panier ;
3. UI panier ;
4. réservations ;
5. commandes ;
6. abstraction paiement ;
7. Stripe test ;
8. webhook ;
9. worker expiration ;
10. liens invités ;
11. e-mails ;
12. tests de concurrence.

### 3C

1. client mobile ;
2. recherche ;
3. panier ;
4. checkout ;
5. deep links ;
6. E2E web ;
7. E2E admin ;
8. smoke mobile ;
9. observabilité ;
10. audit sécurité ;
11. builds de production ;
12. documentation et déploiement.

## Critères d'acceptation

La Phase 3 est terminée lorsque :

- un agriculteur peut se connecter ;
- il ne voit que ses fermes ;
- il peut publier une offre ;
- il peut ajouter et corriger du stock ;
- le client trouve la ferme ;
- il ajoute des produits au panier ;
- le panier refuse plusieurs fermes ;
- le stock est réservé atomiquement ;
- le client paie sans compte ;
- le webhook confirme le paiement ;
- le client suit sa commande ;
- le worker libère les réservations expirées ;
- l'agriculteur traite la commande ;
- le parcours principal fonctionne sur Expo ;
- les tests de concurrence passent ;
- les tests E2E passent ;
- les images serveur sont construites ;
- la documentation de production existe.

## Livrables

- back-office fonctionnel ;
- authentification ;
- stock auditable ;
- panier ;
- checkout invité ;
- paiement ;
- commandes ;
- suivi invité ;
- e-mails ;
- worker ;
- application mobile ;
- tests end-to-end ;
- préparation au déploiement.

## Verdict attendu

```text
PHASE 3 VALIDÉE
```
