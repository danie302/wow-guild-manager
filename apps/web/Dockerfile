# Development image. The build context is the repository root.
# The source and node_modules are mounted by docker-compose.yml, and dependencies
# are installed by the compose "deps" service, so this image only provides Node.js and pnpm.
FROM node:24-trixie-slim AS dev

WORKDIR /app

# Install the pnpm version pinned in the root package.json. Running it once downloads
# pnpm's native binary into the image, so containers don't download it at startup.
COPY package.json ./
RUN corepack enable && corepack install && pnpm --version
