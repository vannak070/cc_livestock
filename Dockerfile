# =======================================================
# Production Multi-Stage Dockerfile for Livestock Management System
#
# Runs BOTH production processes in one container via pm2-runtime and the
# same ecosystem.config.js used by the non-Docker (PM2-on-VPS) deploy path
# in scripts/deploy-production.sh, so the two deploy paths can't drift:
#   - cc-livestock-api : tsx src/server/index.ts on port 3002
#   - cc-livestock-web : next start            on port 3000
# =======================================================

# Stage 1: Base & Dependencies
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl

# Stage 2: Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 4: Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
# pm2-runtime needs a writable home for its logs/state; /app is owned by
# root (files below are copied as root) so point it at /tmp instead of
# giving the non-root user broader write access than it needs.
ENV PM2_HOME /tmp/.pm2

# Create non-root system user for security best practices
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets, built standalone application, and everything the
# backend needs to run via tsx (source + pm2 process config). No .env file
# is baked into the image — real secrets (JWT_SECRET, DB_*) come in at run
# time via the environment docker-compose.yml (or your orchestrator) sets.
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

USER nextjs

# Frontend (next start) and backend (Express API) — see ecosystem.config.js
EXPOSE 3000
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.js"]
