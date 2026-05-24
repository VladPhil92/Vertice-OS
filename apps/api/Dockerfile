FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
# Copy workspace manifests so pnpm resolves workspace packages correctly
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @vertice/api db:generate && pnpm --filter @vertice/api build

# ── Production runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeapp

# Root node_modules contains all hoisted deps (including @prisma/client generated)
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/prisma ./prisma

USER nodeapp
EXPOSE 4000
CMD ["node", "dist/index.js"]

# ── Development (docker-compose local) ───────────────────────────────────────
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Source is volume-mounted by docker-compose
EXPOSE 4000
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@vertice/api", "dev"]
