# Story 041: Running on a home PC with Cloudflare Tunnel

**Status:** Done with debt  
**Phase:** Foundation  
**Depends on:** [Story 040](story-040-production-deployment.md)

## Goal

Run the production stack on an always-on PC at home, Windows included, as a free alternative to the Oracle VM: no public IP or open ports, with HTTPS from Cloudflare Tunnel.

## Scope

- `docker-compose.tunnel.yml`, used together with `docker-compose.prod.yml`: adds a `cloudflared` container (token in `CLOUDFLARE_TUNNEL_TOKEN`), removes the web container's published ports, and makes Caddy serve plain HTTP.
- A Caddyfile whose site address comes from the Compose file (`SITE_ADDRESS`) and that trusts `X-Forwarded-Proto` from the tunnel (`TRUSTED_PROXIES`), so the API still sees HTTPS and sends secure cookies.
- `.gitattributes` with LF line endings, and the backup script run through `sh`, so a Windows checkout works in the Linux containers.
- A section in `docs/deployment.md`: moving the domain's DNS to Cloudflare, creating the tunnel, Docker Desktop on Windows, and starting the stack.

## Out of scope

- Running without Docker on Windows.
- Cloudflare Access or other login in front of the app.

## Acceptance criteria

- [x] With both Compose files, the stack starts without publishing any ports, and Caddy serves the web app and `/api` over HTTP for `APP_DOMAIN`.
- [x] A request forwarded with `X-Forwarded-Proto: https` gets a `Secure` session cookie at login; one without it doesn't.
- [x] Without the tunnel file, Caddy still gets certificates for `APP_DOMAIN` and redirects HTTP to HTTPS.
- [x] A checkout keeps LF line endings on every OS, and the backup script runs without an executable bit.
- [x] The guide covers the Cloudflare DNS move, the tunnel and its public hostname, Docker Desktop on Windows, and starting the stack.

## Notes

- Decided on 2026-10-23: Oracle's Arm instances were out of capacity in every availability domain, and the Guild Master didn't want the card hold that upgrading the account needs, so the stack runs on their Windows PC with Docker Desktop (no separate WSL distribution) behind Cloudflare Tunnel.
- `cloudflared` reaches Caddy over the Docker network from a private address, so Caddy trusts `private_ranges` only in tunnel mode. Without the tunnel it trusts only `127.0.0.1`.

## Technical debt

- Verified locally on Apple Silicon by sending requests to Caddy from another container, with and without `X-Forwarded-Proto: https`. A real Cloudflare Tunnel and a Windows checkout haven't been tried yet; fix the guide if a step differs.
- The app is down whenever the PC sleeps, restarts, or loses its connection. Backups stay on the same PC.
