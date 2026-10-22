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

# Production build: typechecks and builds the web app into apps/web/dist.
FROM dev AS build

COPY pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @wgm/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @wgm/web build

# Production image (docker-compose.prod.yml): Caddy serves the built app, proxies /api to
# the api container, and gets HTTPS certificates for APP_DOMAIN on its own.
FROM caddy:2.10-alpine AS prod

COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
