# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/web/package.json ./apps/web/
COPY packages/engine/package.json ./packages/engine/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY packages/games/package.json ./packages/games/
COPY packages/arena-sdk/package.json ./packages/arena-sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build Next.js
# ============================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages

# Copy all source files
COPY . .

# Set Next.js to produce standalone output
ENV NEXT_TELEMETRY_DISABLED=1

# Build workspace dependencies first, then web
RUN pnpm --filter @clawdbot/engine build || true
RUN pnpm --filter @clawdbot/protocol build || true
RUN pnpm --filter @clawdbot/web build

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/web/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
