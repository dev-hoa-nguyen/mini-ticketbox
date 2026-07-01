#!/bin/sh
set -e

echo "⏳ Áp dụng database migrations (có retry chờ DB sẵn sàng)..."
n=0
until pnpm db:deploy; do
  n=$((n + 1))
  if [ "$n" -ge 10 ]; then
    echo "❌ Không kết nối được database sau 10 lần thử."
    exit 1
  fi
  echo "…DB chưa sẵn sàng, thử lại ($n/10) sau 3s"
  sleep 3
done

echo "🌱 Seed dữ liệu (idempotent — bỏ qua nếu đã có vé)..."
pnpm exec prisma db seed

echo "🚀 Khởi động backend..."
exec node dist/src/server.js
