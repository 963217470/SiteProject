#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run as root'; exit 1; }
umask 077
if [[ "${RD_MAINTENANCE_LOCKED:-0}" != 1 ]]; then
    exec 9>/run/lock/rd-studio-maintenance.lock
    flock -w 120 9 || { echo 'Another deployment or backup is running'; exit 1; }
fi
root=/var/backups/rd-studio/full
install -d -m 700 "$root"
available=$(df --output=avail -B1 "$root" | tail -1)
[[ "$available" -ge 2147483648 ]] || { echo 'Less than 2 GiB free: preserve existing backups and free space manually'; exit 1; }
tools=$(cd -- "$(dirname -- "$0")" && pwd)
node=/opt/rd-studio/node/bin/node
id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
work="$root/$id.incomplete"
install -d -m 700 "$work"
was_active=false
systemctl is-active --quiet rd-studio && was_active=true
restart_needed=false
finish() {
    if "$restart_needed"; then systemctl start rd-studio; fi
}
trap finish EXIT

# Save immutable code first; pause writes only for the database/upload snapshot.
extra=()
[[ ! -d /opt/rd-studio/ops ]] || extra+=(opt/rd-studio/ops)
tar --dereference -czf "$work/application.tgz" -C / \
    opt/rd-studio/current opt/rd-studio/node \
    www/wwwroot/rd-studio.club/current "${extra[@]}"
config_extra=()
for unit in rd-studio-backup.service rd-studio-backup.timer; do
    [[ ! -f "/etc/systemd/system/$unit" ]] || config_extra+=("etc/systemd/system/$unit")
done
tar --dereference -czf "$work/configuration.tgz" -C / \
    etc/rd-studio.env etc/systemd/system/rd-studio.service \
    www/server/panel/vhost/nginx/rd-studio.club.conf \
    etc/nginx/sites-enabled/rd-studio.club.conf \
    etc/letsencrypt/live/rd-studio.club "${config_extra[@]}"
if "$was_active"; then
    restart_needed=true
    systemctl stop rd-studio
fi
# Copy a quiescent database AND its uploads together. Compression and hashing
# happen after restart, keeping the maintenance window short.
install -d -m 700 "$work/snapshot/var/lib"
cp -a /var/lib/rd-studio "$work/snapshot/var/lib/rd-studio"
if "$restart_needed"; then
    systemctl start rd-studio
    restart_needed=false
fi
if "$was_active"; then
    curl -fsS --retry 10 --retry-connrefused --retry-delay 1 --max-time 10 http://127.0.0.1:3100/api/health >/dev/null
fi
"$node" "$tools/data-inventory.mjs" create "$work/snapshot/var/lib/rd-studio" "$work/data-inventory.json"
tar -czf "$work/data.tgz" -C "$work/snapshot" var/lib/rd-studio
printf 'format=2\ncreated_utc=%s\nbackend=%s\nwebsite=%s\n' \
    "$id" "$(readlink /opt/rd-studio/current)" \
    "$(readlink /www/wwwroot/rd-studio.club/current)" > "$work/manifest.txt"
for archive in "$work"/*.tgz; do tar -tzf "$archive" >/dev/null; done
(cd "$work"; sha256sum application.tgz configuration.tgz data.tgz manifest.txt data-inventory.json > SHA256SUMS; sha256sum -c SHA256SUMS)
# Only discard the staging copy inside this newly created backup directory.
[[ "$work" == "$root/"*.incomplete && -d "$work/snapshot/var/lib/rd-studio" ]]
rm -rf -- "$work/snapshot"
mv "$work" "$root/$id"
"$tools/verify-snapshot.sh" "$root/$id" > "$root/$id/restore-drill.log" 2>&1
date -u +%FT%TZ > "$root/$id/VERIFIED"
if [[ -f /root/.rd-studio-backup.key ]]; then
    install -d -m 700 /var/backups/rd-studio/encrypted
    bundle="$root/$id/export.tar"
    tar --exclude=./export.tar -cf "$bundle" -C "$root/$id" .
    "$node" "$tools/backup-crypto.mjs" encrypt "$bundle" "/var/backups/rd-studio/encrypted/$id.tar.enc" /root/.rd-studio-backup.key
    rm -f -- "$bundle"
    (cd /var/backups/rd-studio/encrypted; sha256sum "$id.tar.enc" > "$id.tar.enc.sha256")
fi
echo "Backup: $root/$id"
