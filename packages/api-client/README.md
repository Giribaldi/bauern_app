# API client

Ce package est généré à partir du contrat OpenAPI de l'API Fastify.

```bash
pnpm api:openapi
pnpm api:client:generate
pnpm api:client:check
```

`src/generated/schema.ts` est un artefact généré et ne doit pas être modifié manuellement.
Les prix sont des centimes entiers. Les valeurs PostgreSQL `numeric` (quantités et taux de TVA)
restent des chaînes décimales dans le contrat HTTP afin d'éviter toute perte de précision JavaScript.
