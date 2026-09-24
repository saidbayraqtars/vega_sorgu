# Vega Bulut — VPS imajı (web arayüzü + API). Derleme bağlamı: depo kökü.
#   cd deploy && cp .env.ornek .env && docker compose up -d --build

# 1) Arayüz (web/): varsa derlenir; yoksa API tek başına çalışır ve kökte bilgi metni gösterir
FROM node:22-alpine AS web
WORKDIR /src
COPY . .
RUN if [ -f web/package.json ]; then \
      cd web && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) && npm run build; \
    else mkdir -p web/dist; fi

# 2) Çalışma imajı (Node ≥ 22.13: yerleşik node:sqlite, yerel derleme yok)
FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=8080 HOST=0.0.0.0
WORKDIR /app
COPY cloud/package.json cloud/package-lock.json ./cloud/
RUN cd cloud && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY cloud/src ./cloud/src
COPY shared ./shared
COPY --from=web /src/web/dist ./web/dist
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/saglik').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/cloud
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
