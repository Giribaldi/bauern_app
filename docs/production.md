# Exploitation en production

## Services

Déployer séparément `local-market-api`, `local-market-worker`, `local-market-storefront` et `local-market-admin`, derrière Caddy ou Traefik. Le mobile est distribué par Expo/EAS et les stores. PostgreSQL doit inclure PostGIS. Un stockage objet compatible S3 (R2, Scaleway ou MinIO) implémentera le contrat `ObjectStorage` de l’API.

## Configuration

Secrets obligatoires de l’API : `DATABASE_URL`, `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`. Configurer aussi `API_PORT`, `PUBLIC_STOREFRONT_URL`, `CORS_ORIGINS` (liste séparée par des virgules) et `SESSION_DURATION_SECONDS`. Le worker reçoit `DATABASE_URL`, `SMTP_HOST` et `SMTP_PORT`.

Les secrets restent dans le gestionnaire de secrets de l’hébergeur. Ils ne doivent ni entrer dans une image ni être journalisés. Les cookies de production sont `Secure`, HTTP-only et SameSite=Lax. Le webhook Stripe doit cibler `/v1/webhooks/stripe`.

## Déploiement

1. Construire les quatre images depuis un commit immuable.
2. Exécuter `pnpm db:migrate` comme tâche dédiée et unique.
3. Démarrer l’API et attendre `/ready`.
4. Démarrer le worker, le storefront et l’admin.
5. Exécuter les smoke tests HTTP et le parcours Playwright.

Un arrêt SIGTERM doit laisser l’API fermer son pool et le worker finir son cycle courant. Les journaux structurés sont centralisés par la plateforme ; mots de passe, cookies, jetons invités et signatures n’y figurent jamais.

## Sauvegardes et restauration

Effectuer quotidiennement un `pg_dump --format=custom`, chiffrer le fichier, le transférer hors du serveur et appliquer une politique de conservation (7 quotidiennes, 4 hebdomadaires, 12 mensuelles). Une restauration trimestrielle est obligatoire dans une base isolée : `createdb`, `pg_restore --clean --if-exists`, puis vérification de `/ready`, des migrations et des cardinalités métier.

La rotation d’un secret Stripe implique le déploiement coordonné du nouveau secret de webhook. La rotation des sessions peut être forcée en révoquant les lignes actives de `sessions`.

## Supervision

Surveiller `/health`, `/ready`, latence et taux de réponses 4xx/5xx, réservations expirées, taille de `email_jobs` non traité et âge du plus ancien job. Alerter avant saturation du pool PostgreSQL et de l’espace disque.
