import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] || '')
assert(process.argv[2], 'Provide an isolated extracted snapshot directory')
const database = new DatabaseSync(join(root, 'var/lib/rd-studio/site.sqlite'), { readOnly: true })
try {
  const integrity = database.prepare('PRAGMA integrity_check').all()
  assert.deepEqual(integrity.map(row => row.integrity_check), ['ok'])
  assert.equal(database.prepare('PRAGMA foreign_key_check').all().length, 0)
  for (const table of ['users', 'profiles', 'articles', 'files', 'sessions']) {
    assert(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))
  }
  for (const file of database.prepare('SELECT id,size FROM files').all()) {
    assert.equal(statSync(join(root, 'var/lib/rd-studio/uploads', file.id)).size, file.size)
  }
  for (const path of [
    'opt/rd-studio/current/server/index.mjs',
    'opt/rd-studio/node/bin/node',
    'www/wwwroot/rd-studio.club/current/index.html',
    'etc/rd-studio.env',
    'etc/systemd/system/rd-studio.service',
    'etc/nginx/sites-enabled/rd-studio.club.conf',
    'etc/letsencrypt/live/rd-studio.club/fullchain.pem',
    'etc/letsencrypt/live/rd-studio.club/privkey.pem'
  ]) assert(statSync(join(root, path)).isFile(), `Missing snapshot file: ${path}`)
  assert.equal(statSync(join(root, 'etc/rd-studio.env')).mode & 0o077, 0)
  console.log('Snapshot integrity, foreign keys, uploaded-file sizes and required files verified')
} finally {
  database.close()
}
