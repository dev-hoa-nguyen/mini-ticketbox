# syntax=docker/dockerfile:1
FROM node:22-slim

# openssl cần cho Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

# Cài full deps (giữ tsx để seed, tsc/tsc-alias để build)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile

# Copy source, sinh Prisma Client, build TS -> dist
# (DATABASE_URL giả chỉ để prisma generate không lỗi lúc build; runtime dùng env thật)
COPY . .
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
RUN pnpm db:generate && pnpm build

EXPOSE 8080

# migrate + seed (idempotent) + start
CMD ["sh", "docker-entrypoint.sh"]
