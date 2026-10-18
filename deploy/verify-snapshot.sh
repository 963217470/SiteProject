#!/usr/bin/env bash
set -euo pipefail
umask 077
snapshot=$(realpath -- "${1:?backup directory required}")
[[ "$snapshot" == /var/backups/rd-studio/* && "$snapshot" != *.incomplete && -f "$snapshot/SHA256SUMS" ]]
tools=$(cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d /var/tmp/rd-restore-drill-XXXXXXXX)
cleanup() { [[ "$work" == /var/tmp/rd-restore-drill-* ]] && rm -rf -- "$work"; }
trap cleanup EXIT
(cd "$snapshot"; sha256sum -c SHA256SUMS)
for archive in application configuration data; do
    tar -xzf "$snapshot/$archive.tgz" -C "$work" --no-same-owner
done
args=("$work")
if [[ -f "$snapshot/data-inventory.json" ]]; then args+=("$snapshot/data-inventory.json"); fi
/opt/rd-studio/node/bin/node "$tools/verify-backup.mjs" "${args[@]}"
/opt/rd-studio/node/bin/node --input-type=module - "$work" <<'JS'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
const root=process.argv[2],backend=join(root,'opt/rd-studio/current/server')
const {openDatabase}=await import(pathToFileURL(join(backend,'database.mjs')))
const {createApp}=await import(pathToFileURL(join(backend,'app.mjs')))
const db=openDatabase(join(root,'var/lib/rd-studio/site.sqlite'))
const app=createApp(db,{dataDir:join(root,'var/lib/rd-studio'),sessionSecret:randomBytes(32).toString('hex'),siteUrl:'http://127.0.0.1',production:false,maxUploadMb:100,adminGithubIds:[]})
const server=app.listen(0,'127.0.0.1')
await new Promise(resolve=>server.once('listening',resolve))
try{
  const origin='http://127.0.0.1:'+server.address().port
  const paths=['/api/health','/api/data/articles?select=id,title&status=eq.published&visibility=eq.public&limit=3']
  if(db.prepare('PRAGMA user_version').get().user_version>=13)paths.push('/api/shop/products')
  if(db.prepare('PRAGMA user_version').get().user_version>=15)paths.push('/api/catalog')
  for(const path of paths)assert.equal((await fetch(origin+path)).status,200)
  console.log('Isolated restored application boot and public API smoke checks passed')
}finally{await new Promise(resolve=>server.close(resolve));db.close()}
JS
echo "RESTORE_DRILL_OK=$snapshot"
