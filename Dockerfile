# =============================================================================
# 🌸 MASKA ATELIER DOCKERFILE | متجر واستوديو مسكة للزهور الطبيعية
# =============================================================================
# المرحلة الأولى: تجميع وبناء واجهة Svelte 5 + Vite الأمامية
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# نسخ ملفات تعريف الحزم والاعتماديات
COPY package*.json ./

# تثبيت كافة المكتبات اللازمة للبناء والتطوير
RUN npm install

# نسخ كافة ملفات المشروع والمصادر
COPY . .

# تنفيذ تجميع وبناء مشروع Svelte في مجلد dist
RUN npm run build

# =============================================================================
# المرحلة الثانية: بيئة تشغيل الإنتاج الخفيفة والآمنة (Production Runner)
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# تثبيت مكتبات التشغيل الأساسية فقط (Express, MySQL2, Leaflet, CORS)
COPY package*.json ./
RUN npm install --omit=dev

# نسخ مخرجات واجهة Svelte المبنية
COPY --from=builder /app/dist ./dist

# نسخ أصول الموقع والملفات الثابتة ومحرك الباك إند
COPY --from=builder /app/public ./public
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/database ./database
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/css ./css
COPY --from=builder /app/js ./js
COPY --from=builder /app/legacy-html ./legacy-html
COPY --from=builder /app/*.html ./

# المنفذ المخصص للويب
EXPOSE 3000

# فحص سلامة الحاوية التلقائي
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# تشغيل خادم مسكة
CMD ["node", "server.js"]
