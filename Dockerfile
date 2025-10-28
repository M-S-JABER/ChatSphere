# ---------- Base image & common deps ----------
FROM node:22-alpine AS base
# بعض الحزم تبقى مفيدة للبناء (node-gyp إلخ)
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

# ---------- Stage 1: deps (لإنتاج فقط) ----------
FROM base AS deps
COPY package*.json ./
# تثبيت تبعيات الإنتاج فقط (لصورة التشغيل النهائية)
RUN npm ci --omit=dev

# ---------- Stage 2: build (يحتاج devDeps أيضاً) ----------
FROM base AS build
# ننسخ ملفات التعريف أولاً للاستفادة من الـ layer cache
COPY package*.json ./
RUN npm ci
# ننسخ السورس الكامل
COPY . .

# ملاحظة مهمّة:
# كثير من المشاريع تخرج Vite إلى dist/client وتخرج esbuild للسيرفر إلى dist/server
# إذا سكربت build عندك لا يفعل ذلك تلقائيًا، فعّل هذه المتغيرات أو عدّل سكربتاتك:
# ENV VITE_OUT_DIR=dist/client
# مثال شائع في package.json:
# "build": "vite build --outDir dist/client && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/server"

# نفّذ البناء (يتوقع وجود "build" في package.json)
RUN npm run build

# ---------- Stage 3: runner (خفيـف وآمن) ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# أمن: نُنشئ مستخدم بدون صلاحيات root
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp
USER nodeusr

# ننسخ node_modules الخاصة بالإنتاج فقط
COPY --from=deps /app/node_modules ./node_modules

# ننسخ المخرجات + ملفات التشغيل فقط
# إذا كان مشروعك يخرج كالتالي: dist/server للمخدم و dist/client للواجهة
# عدّل المسارات أدناه لو لديك إخراج مختلف
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# سكربت دخول لتشغيل migrations (drizzle-kit push) اختياري
COPY --chown=nodeusr:nodegrp ./scripts/entrypoint.sh /app/entrypoint.sh

# اجعل المنفذ ثابتًا (عدّله لو سيرفرك يستمع على غيره)
EXPOSE 8080

# Healthcheck بسيط
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
# يشغّل سيرفر Node الخاص بك (حسب سكربت start في package.json)
CMD ["npm", "run", "start"]
