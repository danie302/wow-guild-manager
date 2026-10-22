# The build context is the repository root.

# Development image. The source and node_modules are mounted by docker-compose.yml, and
# dependencies are installed by the compose "deps" service, so this image only provides
# Node.js and pnpm.
FROM node:24-trixie-slim AS dev

WORKDIR /app

# Install the pnpm version pinned in the root package.json. Running it once downloads
# pnpm's native binary into the image, so containers don't download it at startup.
COPY package.json ./
RUN corepack enable && corepack install && pnpm --version

# Production build: installs the server's dependencies, bundles api, bot, and worker with
# esbuild (build.js), then gathers the server with only its production dependencies.
FROM dev AS build

COPY pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @wgm/server...

COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @wgm/server build \
  && pnpm --filter @wgm/server deploy --prod --legacy /out

# Production image (docker-compose.prod.yml): Node.js, the bundled JavaScript, production
# dependencies, and the migrations. The same image runs the api, bot, and worker.
FROM node:24-trixie-slim AS prod

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/.sequelizerc ./
COPY --from=build /app/apps/server/src/db/config.cjs ./src/db/
COPY --from=build /app/apps/server/src/db/migrations ./src/db/migrations

# A new uploads volume takes this directory's owner, so the app can write to it.
RUN mkdir /uploads && chown node:node /uploads
USER node
