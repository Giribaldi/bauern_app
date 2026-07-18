FROM node:24.18.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker build
RUN pnpm deploy --legacy --filter worker --prod /prod/worker

FROM base AS runner
WORKDIR /app
COPY --from=builder /prod/worker ./
CMD ["node", "dist/index.js"]
