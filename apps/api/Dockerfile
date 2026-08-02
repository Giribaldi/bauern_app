FROM node:24.18.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build
RUN pnpm deploy --legacy --filter api --prod /prod/api

FROM base AS runner
WORKDIR /app
COPY --from=builder /prod/api ./
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
