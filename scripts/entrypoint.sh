#!/bin/sh
set -e

echo "[entrypoint] NODE_ENV=$NODE_ENV"

# اختياري: دفع مخطط Drizzle قبل بدء السيرفر
# فعّل هذا السلوك بوضع DB_PUSH_ON_START=true في البيئة
if [ "$DB_PUSH_ON_START" = "true" ]; then
  echo "[entrypoint] Running drizzle-kit push..."
  # إذا كان لديك سكربت في package.json مثل: "db:push": "drizzle-kit push"
  npm run db:push || {
    echo "[entrypoint] drizzle-kit push failed"; exit 1;
  }
fi

# اختياري: health endpoint سريع (لو عندك Express route /health فتمام)
# وإلا يمكنك إضافة ميدلوير بسيط في السيرفر يرجع 200 على /health

echo "[entrypoint] Starting server..."
exec "$@"
