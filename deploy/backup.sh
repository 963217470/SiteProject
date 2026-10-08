#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run as root'; exit 1; }
umask 077
root=/var/backups/rd-studio
install -d -m 700 "$root"
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
tar --dereference -czf "$work/application.tgz" -C / \
    opt/rd-studio/current opt/rd-studio/node \
    www/wwwroot/rd-studio.club/current
tar --dereference -czf "$work/configuration.tgz" -C / \
    etc/rd-studio.env etc/systemd/system/rd-studio.service \
    www/server/panel/vhost/nginx/rd-studio.club.conf \
    etc/nginx/sites-enabled/rd-studio.club.conf \
    etc/letsencrypt/live/rd-studio.club
if "$was_active"; then
    restart_needed=true
    systemctl stop rd-studio
fi
tar -czf "$work/data.tgz" -C / var/lib/rd-studio
if "$restart_needed"; then
    systemctl start rd-studio
    restart_needed=false
fi
printf 'format=1\ncreated_utc=%s\nbackend=%s\nwebsite=%s\n' \
    "$id" "$(readlink /opt/rd-studio/current)" \
    "$(readlink /www/wwwroot/rd-studio.club/current)" > "$work/manifest.txt"
for archive in "$work"/*.tgz; do tar -tzf "$archive" >/dev/null; done
(cd "$work"; sha256sum application.tgz configuration.tgz data.tgz manifest.txt > SHA256SUMS; sha256sum -c SHA256SUMS)
mv "$work" "$root/$id"
echo "Backup: $root/$id"
