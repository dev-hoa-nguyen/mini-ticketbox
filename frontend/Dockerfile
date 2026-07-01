# syntax=docker/dockerfile:1
# TanStack Start (SSR) — chạy dev server để phục vụ cả SSR lẫn client ổn định.
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# VITE_API_URL truyền qua biến môi trường (Vite tự đọc biến prefix VITE_)
# Gọi vite trực tiếp để cờ --host áp dụng đúng (bind 0.0.0.0 cho host truy cập được).
CMD ["pnpm", "exec", "vite", "dev", "--host", "0.0.0.0", "--port", "3000"]
