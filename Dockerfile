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
# Tests are not part of the image, and some import the separate website/ app (left out by .dockerignore), which
# would fail the type check inside `next build`.
RUN find src -name '*.test.ts' -delete
# Files keep the Mac's permissions (some are owner-only, e.g. package.json after npm install); the app runs as a
# non-root user, so make every project file readable before the final stage copies them.
RUN chmod -R a+rX /app
ENV NEXT_TELEMETRY_DISABLED 1
# The farm app's public address is built into the page code (PWA share link, QR); pass it at build time.
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# src/lib/jwt.ts and src/config/database.ts refuse to LOAD without JWT_SECRET / DB_PASSWORD in production, and next build loads it while collecting pages.
# Any value passes the load check (a real, strong one is demanded when a token is signed), so the build gets a
# placeholder on this one command only: it is not kept in the image; the server's .env gives the real secret.
RUN JWT_SECRET=build-only-placeholder-never-used-to-sign-tokens DB_PASSWORD=build-only-placeholder npm run build

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
# Where the API writes the public website snapshot (WEBSITE_SNAPSHOT_DIR); a named volume mounted here keeps this owner.
RUN mkdir -p /data/website-snapshot && chown -R nextjs:nodejs /data

# Copy static assets, built standalone application, and everything the
# backend needs to run via tsx (source + pm2 process config). No .env file
# is baked into the image — real secrets (JWT_SECRET, DB_*) come in at run
# time via the environment docker-compose.yml (or your orchestrator) sets.
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
# .next must be writable by the app user: Next.js keeps its page and image caches there at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js
# The API runs TypeScript with tsx, which needs tsconfig.json to resolve the @/ import paths.
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

# Frontend (next start) and backend (Express API) — see ecosystem.config.js
EXPOSE 3000
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.js"]
