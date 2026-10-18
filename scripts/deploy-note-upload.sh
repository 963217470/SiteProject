#!/usr/bin/env bash
set -euo pipefail
root=/opt/rd-studio
database=/var/lib/rd-studio/site.sqlite
kind=${RD_DEPLOY_KIND:-note-upload}
expected_version=${RD_DB_VERSION:-9}
[[ "$kind" =~ ^[a-z][a-z-]+$ && "$expected_version" =~ ^[0-9]+$ ]]
package="/tmp/rd-$kind-backend.tar.gz"
old=$(readlink -f "$root/current")
[[ -L "$root/current" && "$old" == "$root/releases/"* && -f "$old/server/app.mjs" ]]
[[ -f "$database" && -f "$package" ]]
exec 9>/run/lock/rd-studio-maintenance.lock
flock -w 120 9
export RD_MAINTENANCE_LOCKED=1
[[ -x /opt/rd-studio/ops/backup.sh ]] || { echo 'Install the verified backup tools before deployment'; exit 1; }
/opt/rd-studio/ops/backup.sh
before_version=$(/opt/rd-studio/node/bin/node --input-type=module - "$database" <<'JS'
import { DatabaseSync } from 'node:sqlite'
const db=new DatabaseSync(process.argv[2],{readOnly:true});console.log(db.prepare('PRAGMA user_version').get().user_version);db.close()
JS
)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="$root/releases/rd-$kind-$stamp"
backup="/var/backups/rd-studio/$kind-$stamp"
[[ ! -e "$release" && ! -e "$backup" ]]
mkdir -p "$backup"
tar --exclude=node_modules -czf "$backup/previous-backend.tar.gz" -C "$old" .
sha256sum "$backup/previous-backend.tar.gz" > "$backup/SHA256SUMS"
sha256sum -c "$backup/SHA256SUMS"
cp -a "$old" "$release"
tar -xzf "$package" -C "$release"
export PATH="/opt/rd-studio/node/bin:$PATH"
cd "$release/server"
npm ci --omit=dev --no-audit --no-fund
node --check note-upload.mjs
node --input-type=module -e "await import('./app.mjs')"
stopped=0
snapshot=0
rollback(){
  if [[ "$stopped" == 1 ]]; then
    systemctl stop rd-studio
    # Never overwrite live data after a new release has accepted requests.
    current_version=$(node --input-type=module - "$database" <<'JS'
import { DatabaseSync } from 'node:sqlite'
const db=new DatabaseSync(process.argv[2],{readOnly:true});console.log(db.prepare('PRAGMA user_version').get().user_version);db.close()
JS
)
    if [[ "$current_version" != "$before_version" ]]; then
      printf 'Schema changed: service left stopped; preserve live data and use a forward fix or reviewed compatibility rollback. Backup: %s\n' "$backup" >&2
      return 1
    fi
    ln -s "$old" "$root/current.rollback-$stamp"
    mv -Tf "$root/current.rollback-$stamp" "$root/current"
    systemctl start rd-studio
    printf 'Rolled back backend only; all current data retained\n' >&2
  fi
}
trap rollback ERR
systemctl stop rd-studio
stopped=1
node --input-type=module - "$database" "$backup/site.sqlite" <<'JS'
import { DatabaseSync } from 'node:sqlite'
const db=new DatabaseSync(process.argv[2])
db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
db.prepare('VACUUM INTO ?').run(process.argv[3])
db.close()
const snapshot=new DatabaseSync(process.argv[3],{readOnly:true})
if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Invalid database backup')
snapshot.close()
JS
snapshot=1
chown --reference="$database" "$backup/site.sqlite"
chmod --reference="$database" "$backup/site.sqlite"
sha256sum "$backup/site.sqlite" >> "$backup/SHA256SUMS"
sha256sum -c "$backup/SHA256SUMS"
ln -s "$release" "$root/current.next-$stamp"
mv -Tf "$root/current.next-$stamp" "$root/current"
systemctl start rd-studio
for attempt in {1..15}; do if curl -fsS http://127.0.0.1:3100/api/health -o /dev/null; then break; fi; sleep 1; done
curl -fsS http://127.0.0.1:3100/api/health -o /dev/null
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/mcp-tokens) == 401 ]]
node --input-type=module - "$database" "$expected_version" <<'JS'
import { DatabaseSync } from 'node:sqlite'
const db=new DatabaseSync(process.argv[2],{readOnly:true})
if(db.prepare('PRAGMA user_version').get().user_version!==Number(process.argv[3]))throw new Error('Migration did not complete')
if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Database integrity failed')
db.close()
JS
trap - ERR
printf 'BACKEND=%s\nBACKUP=%s\nPREVIOUS=%s\n' "$release" "$backup" "$old"
