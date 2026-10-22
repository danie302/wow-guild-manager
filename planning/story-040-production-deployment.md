# Story 040: Production deployment

**Status:** Done with debt  
**Phase:** Foundation  
**Depends on:** [Story 002](story-002-docker-dev-environment.md)

## Goal

Run the whole product on one server, so the Guild Master can test it with friends: production images, a production Docker Compose file, HTTPS, backups, and a step-by-step guide for an Oracle Cloud Always Free VM.

## Scope

- A production server image: the api, bot, and worker bundled to JavaScript with esbuild (`@wgm/shared` included, npm dependencies left out), with only production dependencies.
- A production web image: Caddy serving the built web app, proxying `/api` to the API, and getting HTTPS certificates on its own.
- `docker-compose.prod.yml`: Caddy, api, bot, worker, PostgreSQL, Redis, and a daily backup, restarting on failure, with only ports 80 and 443 published.
- A nightly `pg_dump` kept for 7 days, and how to restore one.
- `.env.production.example`, and a deployment guide in `docs/deployment.md` (VM, firewall, DNS at Namecheap, Discord redirect, updating, backups).

## Out of scope

- CI that builds and pushes images (images are built on the VM; decided on 2026-10-22).
- Object storage for uploads (they stay in a Docker volume on the VM).
- Off-server backups and monitoring.

## Acceptance criteria

- [x] `docker compose -f docker-compose.prod.yml up -d --build` builds and starts the whole stack from a clean checkout, on ARM (the Oracle VM and Apple Silicon).
- [x] The server image runs bundled JavaScript (no tsx or TypeScript at runtime), and the api applies pending migrations before it starts.
- [x] Caddy serves the web app (with index.html for client-side routes) and `/api` on the same origin, over HTTPS for `APP_DOMAIN`, redirecting HTTP to HTTPS.
- [x] PostgreSQL and Redis aren't reachable from outside the server.
- [x] A backup runs every day and keeps the last 7; the guide shows how to restore one.
- [x] The guide covers creating the VM, opening ports 80 and 443, the DNS record, the Discord OAuth2 redirect, the first start, updating, and restoring a backup.

## Notes

- Decided on 2026-10-22: esbuild bundle for the server; a subdomain of the user's own domain (`ddazaj.com`, at Namecheap) set in `APP_DOMAIN`; uploads in a Docker volume; images built on the VM with `git pull`; a nightly `pg_dump` kept for 7 days.
- Oracle's Always Free Arm shape gives about 2 OCPUs and 12 GB of memory running all month (1,500 OCPU hours and 9,000 GB hours).

## Technical debt

- Verified locally on Apple Silicon with `APP_DOMAIN=localhost` (build, migrations, health, client-side routes, HTTP to HTTPS, backup and restore, writable uploads). The guide's Oracle and Namecheap steps haven't been run yet; fix the guide if a step differs.
- Backups stay on the same VM; copying them elsewhere is manual (`scp`). Uploaded images aren't backed up.
- No monitoring or alerts: a crash shows only in `docker compose ps` and the logs (services restart on their own).
- api, bot, and worker each declare the same build in `docker-compose.prod.yml`; BuildKit shares the work, but one build service would be tidier.
