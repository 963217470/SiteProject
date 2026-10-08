#!/usr/bin/env bash
set -euo pipefail
release="${1:?release ID required}"
[[ "$release" =~ ^[a-zA-Z0-9-]+$ ]] || exit 1
base=/opt/rd-studio
site=/www/wwwroot/rd-studio.club
nginx_config=/www/server/panel/vhost/nginx/rd-studio.club.conf
nginx_link=/etc/nginx/sites-enabled/rd-studio.club.conf
backend="$base/releases/$release"
web="$site/releases/$release"
[[ ! -e "$backend" && ! -e "$web" ]] || { echo 'Release already exists'; exit 1; }
install -d -m 755 "$base/releases" "$backend" "$web"
tar -xzf "/tmp/$release-backend.tgz" -C "$backend"
tar -xzf "/tmp/$release-web.tgz" -C "$web"

if [[ ! -x "$base/node/bin/node" ]]; then
    install -d -m 755 "$base/node"
    temp=$(mktemp -d)
    curl -fsSL --retry 2 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$temp/SHASUMS256.txt"
    name=$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$/ {print $2}' "$temp/SHASUMS256.txt")
    [[ "$name" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$ ]] || exit 1
    curl -fsSL --retry 2 "https://nodejs.org/dist/latest-v24.x/$name" -o "$temp/$name"
    (cd "$temp"; grep " $name$" SHASUMS256.txt | sha256sum -c -)
    tar -xJf "$temp/$name" -C "$base/node" --strip-components=1
fi
export PATH="$base/node/bin:$PATH"
(cd "$backend/server"; npm ci --omit=dev; npm test)
id rd-studio >/dev/null 2>&1 || useradd --system --home /var/lib/rd-studio --shell /usr/sbin/nologin rd-studio
install -d -o rd-studio -g rd-studio -m 700 /var/lib/rd-studio
if [[ ! -f /etc/rd-studio.env ]]; then
    install -m 600 "$backend/server/.env.example" /etc/rd-studio.env
    secret=$(openssl rand -hex 32)
    sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$secret/" /etc/rd-studio.env
fi
install -m 644 "$backend/deploy/rd-studio.service" /etc/systemd/system/rd-studio.service
previous_backend=$(readlink "$base/current" || true)
previous_web=$(readlink "$site/current" || true)
cp -a "$nginx_config" "$nginx_config.$release.bak"
created_nginx_link=false
database_snapshot="/var/backups/rd-studio/migration-$release.sqlite"
snapshot_ready=false
if ! nginx -T 2>&1 | grep -F -e "# configuration file $nginx_config:" -e "# configuration file $nginx_link:" >/dev/null; then
    [[ ! -e "$nginx_link" && ! -L "$nginx_link" ]] || { echo 'Conflicting Nginx site configuration'; exit 1; }
    created_nginx_link=true
fi
rollback() {
    if "$snapshot_ready"; then
        systemctl stop rd-studio || true
        cp "$database_snapshot" /var/lib/rd-studio/site.sqlite
        rm -f /var/lib/rd-studio/site.sqlite-wal /var/lib/rd-studio/site.sqlite-shm
        chown rd-studio:rd-studio /var/lib/rd-studio/site.sqlite
        chmod 600 /var/lib/rd-studio/site.sqlite
    fi
    cp -a "$nginx_config.$release.bak" "$nginx_config"
    if "$created_nginx_link"; then rm -f "$nginx_link"; fi
    if [[ -n "$previous_web" ]]; then ln -sfn "$previous_web" "$site/current.rollback"; mv -Tf "$site/current.rollback" "$site/current"; fi
    if [[ -n "$previous_backend" ]]; then
        ln -sfn "$previous_backend" "$base/current.rollback"; mv -Tf "$base/current.rollback" "$base/current"
        systemctl restart rd-studio || true
    else systemctl stop rd-studio || true; fi
    nginx -t && systemctl reload nginx || true
}
trap rollback ERR
if [[ -f /var/lib/rd-studio/site.sqlite ]]; then
    install -d -m 700 /var/backups/rd-studio
    [[ ! -e "$database_snapshot" ]] || { echo 'Migration snapshot already exists'; exit 1; }
    systemctl stop rd-studio
    RD_DB_SNAPSHOT="$database_snapshot" node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; const db=new DatabaseSync("/var/lib/rd-studio/site.sqlite"); db.prepare("VACUUM INTO ?").run(process.env.RD_DB_SNAPSHOT); db.close()'
    chmod 600 "$database_snapshot"
    snapshot_ready=true
fi
ln -sfn "$backend" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
systemctl daemon-reload
systemctl enable --now rd-studio
systemctl restart rd-studio
for attempt in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:3100/api/health; then break; fi
    sleep 1
done
curl -fsS http://127.0.0.1:3100/api/health
install -m 644 "$backend/deploy/nginx.conf" "$nginx_config"
if "$created_nginx_link"; then ln -s "$nginx_config" "$nginx_link"; fi
nginx -t
ln -sfn "$web" "$site/current.next"
mv -Tf "$site/current.next" "$site/current"
systemctl reload nginx
curl -fsS --retry 5 --retry-connrefused --retry-delay 1 --resolve rd-studio.club:443:127.0.0.1 https://rd-studio.club/api/health
trap - ERR
echo "Deployed $release"
