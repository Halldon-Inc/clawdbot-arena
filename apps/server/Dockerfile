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
COPY apps/server/package.json ./apps/server/
COPY packages/engine/package.json ./packages/engine/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY packages/games/package.json ./packages/games/
COPY packages/arena-sdk/package.json ./packages/arena-sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build TypeScript
# ============================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages ./packages

# Copy all source files
COPY . .

# Build workspace dependencies first, then server
RUN pnpm --filter @clawdbot/engine build || true
RUN pnpm --filter @clawdbot/protocol build || true
RUN pnpm --filter @clawdbot/games build || true
RUN pnpm --filter @clawdbot/server build

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1001 appuser

# Copy built server output
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

# Copy built workspace packages
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/engine/package.json ./packages/engine/
COPY --from=builder /app/packages/protocol/dist ./packages/protocol/dist
COPY --from=builder /app/packages/protocol/package.json ./packages/protocol/
COPY --from=builder /app/packages/games/dist ./packages/games/dist
COPY --from=builder /app/packages/games/package.json ./packages/games/

# Copy root node_modules for shared deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER appuser

EXPOSE 8080

ENV PORT=8080

CMD ["node", "apps/server/dist/index.js"]
