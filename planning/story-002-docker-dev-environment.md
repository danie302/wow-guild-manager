# Story 002: Docker development environment

**Status:** Done  
**Phase:** Foundation  
**Depends on:** [Story 001](story-001-monorepo-scaffold.md)

## Goal

Run the whole stack locally with one command, without installing Node or databases on the host.

## Scope

- Development Dockerfiles for `apps/web` and `apps/server`.
- `docker-compose.yml` with six services: `web`, `api`, `bot`, `worker`, `postgres`, and `redis`.
- Placeholder entry points for `api`, `bot`, and `worker` that log a startup message and keep running.
- Named volumes for PostgreSQL data, Redis data, and `node_modules`.
- `.env.example` and `.dockerignore`.

## Out of scope

- Production images.
- Real application behavior in any service.

## Acceptance criteria

- [x] After copying `.env.example` to `.env`, `docker compose up` starts all six containers without errors.
- [x] `api`, `bot`, and `worker` run from the same server image with different start commands.
- [x] Saving a file in `apps/server` restarts the `api`, `bot`, and `worker` processes automatically.
- [x] Saving a file in `apps/web` hot-reloads the page in the browser.
- [x] PostgreSQL data survives `docker compose down` followed by `up`. `docker compose down -v` resets it.
- [x] Redis is configured with persistence (append-only file), so queued jobs survive a restart.
- [x] `node_modules` lives in Docker volumes and isn't shared with the host.
- [x] Every variable in `.env.example` has a comment explaining it.
- [x] The README explains how to start the stack and which ports to open.

## Notes

- A one-shot `deps` service runs `pnpm install` into the `node_modules` volumes on every `up` and exits. The other Node.js services wait for it, so new dependencies are picked up without rebuilding images, and the containers don't race to install.
- Only `deps` builds the server image. `api`, `bot`, and `worker` reuse it (`pull_policy: never`), because several services building the same image name at once fails.
- The server processes run with `tsx watch`, which watches all of `apps/server/src` and `packages/shared/src`, so any change restarts all three.
- The web placeholder is a plain Vite page (React comes in story 006). Without React, Vite does a full page reload instead of a module hot swap.
- Host ports are configurable in `.env`, in case one is already in use.

## Technical debt

None.
