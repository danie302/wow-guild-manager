# Deployment

How to run WoW Guild Manager on one server with `docker-compose.prod.yml`, using an Oracle Cloud Always Free VM. Any Linux server with Docker works the same way from step 4 on.

## What runs

| Service | What it does |
|---|---|
| `web` | Caddy: serves the built web app, proxies `/api` to the API, and gets and renews the HTTPS certificate for `APP_DOMAIN`. The only service with published ports (80 and 443). |
| `api` | The Express API. Applies pending database migrations every time it starts. |
| `bot` | The Discord bot. |
| `worker` | Background jobs: event posts, direct messages, reminders, alerts, recurring events. |
| `postgres`, `redis` | Data. Not reachable from outside the server. |
| `backup` | Dumps the database every day at `BACKUP_HOUR` (UTC) into `./backups`, keeping the last `BACKUP_KEEP_DAYS` days. |

The images are built on the server (`--build`). The api, bot, and worker share one image with the server bundled to JavaScript (`apps/server/build.js`). The stack uses about 350 MB of memory when idle.

## 1. Create the VM

1. Sign up for [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/). Pick a home region close to your players; it can't be changed later.
2. Go to **Compute → Instances → Create instance**:
   - **Image:** Canonical Ubuntu 24.04.
   - **Shape:** Ampere, `VM.Standard.A1.Flex`, with **2 OCPUs and 12 GB** of memory. That stays within the Always Free hours (1,500 OCPU hours and 9,000 GB hours a month) with the VM running all month.
   - **Networking:** a new virtual cloud network with a public subnet, and **Assign a public IPv4 address** on.
   - **SSH keys:** upload your public key (e.g. `~/.ssh/id_ed25519.pub`; create one with `ssh-keygen -t ed25519` if you don't have one).
   - **Boot volume:** the default 50 GB is plenty (up to 200 GB is free).
3. If creating it fails with "Out of capacity", try another availability domain, or try again later.
4. Note the instance's **public IP address**. It can change if you stop the instance; then update the DNS record (step 3).

## 2. Open ports 80 and 443

Two firewalls block them by default.

1. **Oracle's network:** open the instance's subnet, then its **Security List**, and **Add Ingress Rules** with source `0.0.0.0/0`:
   - TCP, destination port `80`
   - TCP, destination port `443`
   - UDP, destination port `443` (HTTP/3; optional)
2. **The VM's own firewall:** Oracle's Ubuntu images come with iptables rules that reject everything but SSH. After connecting (`ssh ubuntu@<public IP>`):

   ```sh
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 3. Point the domain at the VM

The app needs a domain for HTTPS (Discord only accepts HTTPS login redirects outside localhost). With `ddazaj.com` at Namecheap, use a subdomain, e.g. `guild.ddazaj.com`:

1. In Namecheap, open **Domain List → Manage** next to `ddazaj.com`, then **Advanced DNS**.
2. **Add New Record:** type **A Record**, host `guild`, value the VM's public IP, TTL **Automatic**.
3. Wait until it resolves (usually a few minutes): `dig +short guild.ddazaj.com` prints the IP.

If the domain uses other nameservers (e.g. Cloudflare), add the record there instead. With Cloudflare, leave the record **DNS only** (grey cloud) so Caddy can get its certificate.

## 4. Install Docker

On the VM:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # log in again so the group applies
```

The script is Docker's official installer for Ubuntu ([docs](https://docs.docker.com/engine/install/ubuntu/)). Check it with `docker run --rm hello-world`.

## 5. Set up Discord

Use a **separate Discord application** for production. Two bots running with the same token (your local stack and the server) both answer every button click, and the second answer fails. Create it as in "Set up Discord" in `README.md`, with two differences:

- Under **OAuth2 → Redirects**, add `https://<APP_DOMAIN>/api/auth/discord/callback` (e.g. `https://guild.ddazaj.com/api/auth/discord/callback`).
- Invite this bot to the Discord server your guild will use.

Class and role icons for event posts belong to the application, so upload them for the production one from your machine: with the local stack running, `docker compose exec -e DISCORD_BOT_TOKEN=<production bot token> api pnpm --filter @wgm/server discord:emojis`.

## 6. Get the code and configure it

```sh
git clone https://github.com/danie302/wow-guild-manager.git
cd wow-guild-manager
cp .env.production.example .env
chmod 600 .env
nano .env
```

If the repository is private, `git clone` asks for your GitHub username and a [personal access token](https://github.com/settings/tokens) with read access to it, instead of your password.

Fill in every value in `.env`; the file explains each one. Generate the secrets with:

```sh
openssl rand -hex 24      # POSTGRES_PASSWORD
openssl rand -base64 48   # SESSION_SECRET
```

## 7. Start

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes a few minutes. Then:

- `docker compose -f docker-compose.prod.yml ps` lists the services; all should be `Up`.
- `docker compose -f docker-compose.prod.yml logs -f web` shows Caddy getting the certificate. If it fails, check the DNS record and the ports (steps 2 and 3).
- `https://<APP_DOMAIN>/api/health` shows whether the API reaches PostgreSQL and Redis.
- Open `https://<APP_DOMAIN>` and log in with Discord. The first person to log in sets up the guild.

To type less, set an alias: `echo "alias dc='docker compose -f docker-compose.prod.yml'" >> ~/.bashrc`, then `dc ps`, `dc logs -f api`, and so on.

## Update

```sh
cd wow-guild-manager
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

The api applies new migrations when it starts. A change to `.env` also needs `up -d` (`restart` keeps the old environment).

## Backups

The `backup` service writes `backups/wgm-<date>.dump` every day at `BACKUP_HOUR` (UTC). The backups are on the same VM, so copy them elsewhere now and then:

```sh
scp 'ubuntu@<public IP>:wow-guild-manager/backups/*' .
```

To back up right away: `docker compose -f docker-compose.prod.yml exec backup sh -c 'pg_dump --format=custom --file=/backups/wgm-manual.dump'`.

### Restore a backup

This replaces the current data with the backup's. Stop the app first, so nothing writes during the restore:

```sh
dc() { docker compose -f docker-compose.prod.yml "$@"; }
dc stop api bot worker
dc exec -T postgres sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/wgm-<date>.dump
dc start api bot worker
```

Uploaded guild images live in the `uploads` volume, which isn't backed up; a lost image can be uploaded again in the guild settings.

## Reset everything

`docker compose -f docker-compose.prod.yml down -v` deletes the database, Redis, uploads, and certificates. The `backups` folder stays.
