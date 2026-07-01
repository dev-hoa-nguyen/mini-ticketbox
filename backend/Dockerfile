# syntax=docker/dockerfile:1.7

################################
# Base: node + pnpm (corepack)
################################
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

################################
# deps: full deps (dev+prod), cached qua lockfile
################################
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

################################
# build: generate prisma client + compile TS -> dist
################################
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
RUN pnpm db:generate
RUN pnpm build

################################
# prod-deps: chỉ dependencies production (prisma client dùng driver adapter,
# không sinh engine binary, compiled sẵn trong dist/generated)
################################
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --no-optional --frozen-lockfile

################################
# runtime: image cuối, không dev deps, không source TS
################################
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER nodejs
EXPOSE 8080
CMD ["node", "dist/src/server.js"]
