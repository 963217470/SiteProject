# RD STUDIO self-hosted deployment

Production: https://rd-studio.club (Aliyun 47.108.67.83, Ubuntu 22.04, Nginx).

## Architecture

- VitePress static site: `/www/wwwroot/rd-studio.club/current`.
- Node.js 24 backend: `/opt/rd-studio/current/server`; service `rd-studio` listens on loopback port 3100.
- Nginx proxies `/api/` to the backend. No Supabase service is used.
- SQLite database, persistent sessions and uploads: `/var/lib/rd-studio/`.
- Root-only configuration: `/etc/rd-studio.env`.
- GitHub accounts are identified by immutable numeric IDs; sessions use HttpOnly, Secure, SameSite cookies.
- Public readers see published public articles. Members can read internal articles and download internal files. Only admins can publish, review profiles, manage knowledge branches and resources. Authors submit drafts and pending articles.

This deployment starts with a new database as requested; cloud data is not imported.

## GitHub OAuth App

Create an app at https://github.com/settings/developers:

- Homepage URL: `https://rd-studio.club`
- Authorization callback URL: `https://rd-studio.club/api/auth/github/callback`

Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` directly in `/etc/rd-studio.env` and restart:

```bash
sudoedit /etc/rd-studio.env
sudo systemctl restart rd-studio
```

`ADMIN_GITHUB_IDS` is a comma-separated list of numeric GitHub user IDs allowed to bootstrap admin access. GitHub usernames are not IDs. There is no automatic first-user admin. Users can be promoted after their first login:

```bash
sudo -u rd-studio env DATA_DIR=/var/lib/rd-studio /opt/rd-studio/node/bin/node /opt/rd-studio/current/server/admin.mjs GITHUB_ID member
```

OAuth credentials and session secrets must never be committed or put in frontend environment variables.

## Build And Deploy

```bash
npm ci --prefix server
npm test --prefix server
node --test tests/api-client.test.mjs
npm run build
```

Package only the `server` source, lockfile, deployment scripts, and built frontend. Exclude `.env`, private keys, `node_modules`, databases and uploaded files. Upload backend and web archives as `/tmp/RELEASE-backend.tgz` and `/tmp/RELEASE-web.tgz`. Extract `deploy/install.sh` from the backend archive and run it with the release ID as its argument. The installer verifies the Node download checksum, tests the backend, preserves configuration, and switches release symlinks after health checks. Previous releases remain available; Nginx configuration is backed up.

Uploads default to 100 MB. If changing `MAX_UPLOAD_MB`, update Nginx `client_max_body_size` as well. Internal resources are downloaded through the authenticated API, never directly from a public directory.

GitHub Actions builds and tests the frontend and backend, and uploads a website artifact. It no longer publishes to GitHub Pages. Git push alone cannot update the Aliyun server; use the release installer. System Nginx loads this site's configuration through `/etc/nginx/sites-enabled/rd-studio.club.conf`, linked to `/www/server/panel/vhost/nginx/rd-studio.club.conf`.

## Operations

```bash
systemctl status rd-studio
journalctl -u rd-studio --since '10 minutes ago'
curl https://rd-studio.club/api/health
```

Back up the database and uploads together. For a simple consistent backup, briefly stop the service, copy the entire `/var/lib/rd-studio` directory and root-only configuration to protected backup storage, then restart. Never copy a live SQLite file without its WAL or a SQLite backup tool.

Schema version 1 initializes all application tables automatically. Future schema changes require explicit migrations. Deployment rollback changes code and web symlinks, not database contents.
