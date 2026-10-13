#!/usr/bin/env bash
set -euo pipefail
root=/opt/rd-studio
old=$(readlink -f "$root/current")
[[ -L "$root/current" && "$old" == "$root/releases/"* && -f "$old/server/app.mjs" ]]
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="$root/releases/rd-access-$stamp"
[[ ! -e "$release" ]]
backup="/var/backups/rd-studio/internal-access-$stamp"
mkdir -p "$backup"
tar --exclude=node_modules -czf "$backup/previous-backend.tar.gz" -C "$old" .
sha256sum "$backup/previous-backend.tar.gz" > "$backup/SHA256SUMS"
sha256sum -c "$backup/SHA256SUMS"
cp -a "$old" "$release"
tar -xzf /tmp/rd-internal-access.tar.gz -C "$release/server"
for file in app.mjs repository.mjs community.mjs experience.mjs; do /opt/rd-studio/node/bin/node --check "$release/server/$file"; done
rollback(){ ln -s "$old" "$root/current.rollback-$stamp"; mv -Tf "$root/current.rollback-$stamp" "$root/current"; systemctl restart rd-studio; }
trap rollback ERR
ln -s "$release" "$root/current.next-$stamp"
mv -Tf "$root/current.next-$stamp" "$root/current"
systemctl restart rd-studio
for attempt in {1..15}; do if curl -fsS http://127.0.0.1:3100/api/health -o /dev/null; then break; fi; sleep 1; done
curl -fsS http://127.0.0.1:3100/api/health -o /dev/null
curl -fsS http://127.0.0.1:3100/api/internal/access
trap - ERR
printf '\nBACKEND=%s\nBACKUP=%s\nPREVIOUS=%s\n' "$release" "$backup" "$old"
