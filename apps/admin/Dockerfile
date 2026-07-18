FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter admin build
RUN pnpm deploy --legacy --filter admin --prod /prod/admin

FROM base AS runner
WORKDIR /app
COPY --from=builder /prod/admin ./
CMD ["npm", "start"]
