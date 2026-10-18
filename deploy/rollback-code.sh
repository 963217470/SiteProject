#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]]
umask 077
backend=$(realpath -- "${1:?backend release required}")
website=$(realpath -- "${2:?frontend release required}")
[[ "$backend" == /opt/rd-studio/releases/* && -f "$backend/server/index.mjs" ]]
[[ "$website" == /www/wwwroot/rd-studio.club/releases/* && -f "$website/index.html" ]]
tools=$(cd -- "$(dirname -- "$0")" && pwd)
exec 9>/run/lock/rd-studio-maintenance.lock
flock -w 120 9
export RD_MAINTENANCE_LOCKED=1
"$tools/backup.sh"
/opt/rd-studio/node/bin/node "$tools/check-code-compatibility.mjs" "$backend" /var/lib/rd-studio/site.sqlite
old_backend=$(readlink -f /opt/rd-studio/current)
old_website=$(readlink -f /www/wwwroot/rd-studio.club/current)
stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
switch_code() {
    ln -s "$1" "/opt/rd-studio/next-$stamp"; mv -Tf "/opt/rd-studio/next-$stamp" /opt/rd-studio/current
    ln -s "$2" "/www/wwwroot/rd-studio.club/next-$stamp"; mv -Tf "/www/wwwroot/rd-studio.club/next-$stamp" /www/wwwroot/rd-studio.club/current
}
revert() { systemctl stop rd-studio; switch_code "$old_backend" "$old_website"; systemctl start rd-studio; }
trap revert ERR
systemctl stop rd-studio
switch_code "$backend" "$website"
systemctl start rd-studio
curl -fsS --retry 10 --retry-connrefused --retry-delay 1 --max-time 10 http://127.0.0.1:3100/api/health >/dev/null
curl --resolve rd-studio.club:443:127.0.0.1 -fsS --max-time 15 https://rd-studio.club/ >/dev/null
trap - ERR
echo 'Code rollback completed. Current database and uploads were not replaced.'
