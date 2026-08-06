FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
# Copy workspace manifests so pnpm resolves workspace packages correctly.
# apps/api/prisma is needed too (not just package.json): @vertice/api's
# postinstall runs `prisma generate`, which requires prisma/schema.prisma to
# exist — without it, `pnpm install` fails outright before any source is even
# copied. --ignore-scripts is NOT an option here either: it would also skip
# bcrypt's own postinstall, which compiles/downloads its native binary.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# pnpm gives every workspace package its own node_modules of symlinks into
# the root .pnpm store — apps/api/node_modules is NOT the same as (and is not
# contained in) the root node_modules copied above, and node_modules is
# git-ignored so `COPY . .` below won't bring it in either.
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
# @vertice/api resolves @vertice/types from its compiled dist/ (TS project
# reference, paths → packages/types/dist/index.d.ts) — must be built first,
# plain `tsc` does not follow project references the way `tsc --build` would.
RUN pnpm --filter @vertice/types build
RUN pnpm --filter @vertice/api db:generate && pnpm --filter @vertice/api build

# ── Production runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeapp

# The monorepo's real directory layout has to survive the copy: pnpm's
# workspace symlinks (apps/api/node_modules/* → root node_modules/.pnpm/...,
# and apps/api/node_modules/@vertice/types → packages/types) are RELATIVE —
# flattening dist+node_modules into a single top-level pair (as a normal
# single-package Dockerfile would) leaves every one of those symlinks
# dangling. Verified by hand: `node apps/api/dist/index.js` with exactly this
# layout resolves fastify, the generated @prisma/client, and @vertice/types;
# a flattened ./dist + ./node_modules layout does not.
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nodeapp:nodejs /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder --chown=nodeapp:nodejs /app/packages/types/dist ./packages/types/dist

USER nodeapp
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]

# ── Development (docker-compose local) ───────────────────────────────────────
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Same reason as the runner stage above: apps/api's actual deps (fastify,
# @prisma/client, etc.) live in apps/api/node_modules, not the root one.
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
# Source is volume-mounted by docker-compose
EXPOSE 4000
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@vertice/api", "dev"]
