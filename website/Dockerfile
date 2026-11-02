# CamCow public website (separate Next.js app). Production image for the DigitalOcean deploy (deploy/digitalocean/).
# It reads the public snapshot and sends its forms through CC Livestock's API gateway (CAMCOW_API_URL/CAMCOW_API_KEY),
# so it needs no database access of its own. Build on the Mac with --platform linux/amd64 (the droplet is small).

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Files keep the Mac's permissions (some are owner-only, e.g. package.json after npm install); the app runs as a
# non-root user, so make every project file readable before the final stage copies them.
RUN chmod -R a+rX /app
# The site's own public address (share links, sitemap, canonical URLs).
ARG SITE_URL=https://camcow.com.kh
ENV SITE_URL=$SITE_URL
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CAMCOW_OUTBOX_DIR=/data/outbox
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 web \
  && mkdir -p /data/outbox && chown -R web:nodejs /data
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
# .next must be writable by the app user: Next.js keeps its page (ISR) and image caches there at runtime.
COPY --from=builder --chown=web:nodejs /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
# next start reads next.config.ts again, which imports the security headers.
COPY --from=builder /app/src/lib/security-headers.ts ./src/lib/security-headers.ts
USER web
EXPOSE 3200
CMD ["node_modules/.bin/next", "start", "-p", "3200"]
