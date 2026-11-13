# syntax=docker/dockerfile:1.7
# Image multi-étapes : deps → (dev) → build → runtime (sans dépendances de développement, utilisateur non root).
ARG NODE_IMAGE=node:26-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm CI=true HUSKY=0
RUN npm install -g pnpm@11.28.9 && apk add --no-cache libc6-compat
WORKDIR /app

# --- Toutes les dépendances (dev comprises) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# --- Développement : le code est monté en volume, rechargement à chaud ---
FROM deps AS dev
ENV NODE_ENV=development WATCH_POLL=1 HOST=0.0.0.0
EXPOSE 4321
# --force : remplace un verrou .astro/dev.json laissé par un arrêt brutal (un seul serveur par conteneur)
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--force"]

# --- Construction ---
FROM deps AS build
COPY . .
RUN pnpm build

# --- Dépendances de production seulement ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod --ignore-scripts

# --- Exécution ---
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 UPLOAD_DIR=/data/uploads
WORKDIR /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node package.json ./
COPY --chown=node:node scripts/run.mjs ./scripts/run.mjs
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/api/health >/dev/null || exit 1
CMD ["node", "dist/start.mjs"]
