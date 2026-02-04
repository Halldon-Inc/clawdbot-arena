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

# Copy package.json for oracle
COPY apps/oracle/package.json ./apps/oracle/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build TypeScript
# ============================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/oracle/node_modules ./apps/oracle/node_modules

# Copy source files
COPY apps/oracle ./apps/oracle
COPY tsconfig.json ./

# Build oracle
RUN cd apps/oracle && npx tsc

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1001 appuser

# Copy built oracle output
COPY --from=builder /app/apps/oracle/dist ./apps/oracle/dist
COPY --from=builder /app/apps/oracle/package.json ./apps/oracle/

# Copy node_modules
COPY --from=builder /app/apps/oracle/node_modules ./apps/oracle/node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER appuser

CMD ["node", "apps/oracle/dist/index.js"]
