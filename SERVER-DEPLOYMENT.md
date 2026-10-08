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

Run `sudo bash deploy/backup.sh` from a release source directory. Snapshots are created under `/var/backups/rd-studio/` with root-only access and SHA256 checksums. They include code/runtime, frontend, database/uploads, environment configuration, systemd service, Nginx site configuration, and dereferenced TLS files. Credentials in these archives are sensitive: never commit them or place them inside the website directory. Copy snapshots to protected off-server storage for protection against server/disk loss; an on-server snapshot alone is not disaster recovery.

The script briefly stops the backend only while copying database/uploads and restarts it on failure. Never copy a live SQLite file without its WAL or a SQLite backup tool. Failed snapshots retain an `.incomplete` suffix and must not be used as recovery points.

Before recovery, verify `sha256sum -c SHA256SUMS` and create a fresh safety snapshot. Extract into a private staging directory and inspect the manifest; do not untar blindly over `/`. For a code-only rollback, restore previous release symlinks and restart the service without replacing data. For full recovery, stop the backend, preserve the current data directory, restore database and uploads as one unit with owner `rd-studio` and private permissions, restore the matching release/configuration, validate `nginx -t`, then restart and check health/login. Full recovery loses changes made after the chosen snapshot. Test this procedure in isolation before performing a live full rollback.

Schema version 1 initializes all application tables automatically. Future schema changes require explicit migrations. Deployment rollback changes code and web symlinks, not database contents.

### Verified Baseline Snapshot

On 2026-10-08, snapshot `/var/backups/rd-studio/20261008T005856Z-5728` was created (59 MB). SHA256 checks and isolated extraction passed. `deploy/verify-backup.mjs` confirmed SQLite integrity, foreign keys, uploaded-file sizes, required files, and environment-file permissions. All seven backend tests passed using the restored runtime and source. Production health passed after backup. The isolated recovery staging directory is `/var/backups/rd-studio/recovery-check-aHnXaD`, root-only. No live database was overwritten. This is not an off-server backup or a full production restore test.

The server has `/usr/local/sbin/rd-studio-backup` installed for subsequent manual snapshots. New OAuth credentials require a new snapshot after configuration. Development phases and outstanding inputs are tracked in `DEVELOPMENT-ROADMAP.md`.
