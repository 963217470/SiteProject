#!/usr/bin/env bash
set -euo pipefail
root=/www/wwwroot/rd-studio.club
package=/tmp/rd-youthful-frontend.tar.gz
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="$root/releases/rd-ui-$stamp"
backup="/var/backups/rd-studio/frontend-ui-$stamp"
old=$(readlink -f "$root/current")
[[ -L "$root/current" && "$old" == "$root/releases/"* && -f "$old/index.html" ]]
[[ -f "$package" && ! -e "$release" ]]
mkdir -p "$backup" "$release"
tar -czf "$backup/previous-frontend.tar.gz" -C "$old" .
printf '%s\n' "$old" > "$backup/previous-path.txt"
sha256sum "$backup/previous-frontend.tar.gz" > "$backup/SHA256SUMS"
sha256sum -c "$backup/SHA256SUMS"
tar -xzf "$package" -C "$release"
for file in index.html kb/index.html articles/index.html tasks/index.html games-tools/index.html user/profile.html editor/index.html login/index.html; do
  [[ -s "$release/$file" ]]
done
switched=0
rollback() {
  if [[ "$switched" == 1 ]]; then
    ln -s "$old" "$root/current.rollback-$stamp"
    mv -Tf "$root/current.rollback-$stamp" "$root/current"
    printf 'Rolled back to %s\n' "$old" >&2
  fi
}
trap rollback ERR
ln -s "$release" "$root/current.next-$stamp"
mv -Tf "$root/current.next-$stamp" "$root/current"
switched=1
for route in / /kb/ /articles/ /tasks/ /games-tools/ /login/ /editor/ /user/profile /messages/ /admin; do
  curl --resolve rd-studio.club:443:127.0.0.1 -fsSL --max-time 20 "https://rd-studio.club$route" -o /dev/null
done
curl --resolve rd-studio.club:443:127.0.0.1 -fsS --max-time 20 https://rd-studio.club/api/health -o /dev/null
trap - ERR
printf 'RELEASE=%s\nBACKUP=%s\nPREVIOUS=%s\n' "$release" "$backup" "$old"
