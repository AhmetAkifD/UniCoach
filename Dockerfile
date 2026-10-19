# syntax=docker/dockerfile:1
# UniCoach — tek Dockerfile, iki hedef: `api` ve `web` (docker-compose.yml bunları kullanır).

FROM node:24-slim AS base
# Prisma motoru OpenSSL ister.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Bağımlılıklar (yalnızca package.json'lar değişince yeniden kurulur) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/design/package.json packages/design/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# --- Ortak paketlerin derlenmesi ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build:packages

# --- API ---
FROM build AS api-build
RUN npm run build -w @unicoach/api \
  && npm prune --omit=dev \
  && cd apps/api && npx prisma generate

FROM base AS api
ENV NODE_ENV=production API_PORT=4000
COPY --from=api-build /app/package.json ./
COPY --from=api-build /app/node_modules node_modules
COPY --from=api-build /app/packages packages
COPY --from=api-build /app/apps/api/package.json apps/api/
COPY --from=api-build /app/apps/api/prisma apps/api/prisma
COPY --from=api-build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 4000
# Açılışta bekleyen migration'lar uygulanır, ardından API başlar.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]

# --- Web ---
FROM build AS web-build
# /api/* isteklerinin aktarılacağı adres (Next.js rewrite derleme anında sabitlenir).
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
RUN npm run build -w @unicoach/web

FROM node:24-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
