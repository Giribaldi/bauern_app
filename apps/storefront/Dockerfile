FROM node:24.18.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter storefront build
RUN pnpm deploy --legacy --filter storefront --prod /prod/storefront

FROM base AS runner
WORKDIR /app
COPY --from=builder /prod/storefront ./
COPY --from=builder /app/packages/typescript-config ./node_modules/@local-market/typescript-config
CMD ["npm", "start"]
