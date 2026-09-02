FROM node:20-alpine AS base
# Prisma 5 requires a detectable OpenSSL/libssl runtime. node:20-alpine does
# not guarantee it, which makes the schema/query engine fail before migrations
# or the HTTP server can start.
RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@10.11.0 --activate

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

# ── Development (docker-compose local) ───────────────────────────────────────
# Keep this stage before `runner`: Docker/Railway use the LAST stage when no
# explicit target is supplied. Having development last caused production to
# deploy an image with no source tree and the dev CMD, which exited with
# `No projects found in "/app"` and then exhausted Railway's healthcheck.
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Same reason as the runner stage below: apps/api's actual deps (fastify,
# @prisma/client, etc.) live in apps/api/node_modules, not the root one.
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
# Source is volume-mounted by docker-compose
EXPOSE 4000
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@vertice/api", "dev"]

# ── Production runner (MUST remain the final stage) ──────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# The production image also executes `prisma migrate deploy`; OpenSSL must be
# present here, not only in the builder where Prisma Client is generated.
RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nodeapp

# The monorepo's real directory layout has to survive the copy: pnpm's
# workspace symlinks (apps/api/node_modules/* → root node_modules/.pnpm/...,
# and apps/api/node_modules/@vertice/types → packages/types) are RELATIVE —
# flattening dist+node_modules into a single top-level pair (as a normal
# single-package Dockerfile would) leaves every one of those symlinks
# dangling.
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nodeapp:nodejs /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder --chown=nodeapp:nodejs /app/packages/types/dist ./packages/types/dist

USER nodeapp
EXPOSE 4000
# Production boot is self-contained: apply only pending Prisma migrations using
# the schema's real monorepo path, then replace the shell with the API process.
CMD ["sh", "-c", "./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma && exec node apps/api/dist/index.js"]
