# Story 002: Docker development environment

**Status:** Not started  
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

- [ ] After copying `.env.example` to `.env`, `docker compose up` starts all six containers without errors.
- [ ] `api`, `bot`, and `worker` run from the same server image with different start commands.
- [ ] Saving a file in `apps/server` restarts the `api`, `bot`, and `worker` processes automatically.
- [ ] Saving a file in `apps/web` hot-reloads the page in the browser.
- [ ] PostgreSQL data survives `docker compose down` followed by `up`. `docker compose down -v` resets it.
- [ ] Redis is configured with persistence (append-only file), so queued jobs survive a restart.
- [ ] `node_modules` lives in Docker volumes and isn't shared with the host.
- [ ] Every variable in `.env.example` has a comment explaining it.
- [ ] The README explains how to start the stack and which ports to open.

## Technical debt

None.
