import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { closeSync, existsSync, lstatSync, openSync, readSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function digest(path) {
  const hash = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024), fd = openSync(path, 'r')
  try { for (let n; (n = readSync(fd, buffer, 0, buffer.length, null));) hash.update(buffer.subarray(0, n)) }
  finally { closeSync(fd) }
  return hash.digest('hex')
}

export function inventory(directory) {
  const root = realpathSync(directory), db = new DatabaseSync(join(root, 'site.sqlite'), { readOnly: true })
  let version, tables
  try {
    assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row => row.integrity_check), ['ok'], 'Database integrity failed')
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0, 'Foreign key check failed')
    version = db.prepare('PRAGMA user_version').get().user_version
    tables = Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => [name, db.prepare('SELECT count(*) n FROM "' + name.replaceAll('"', '""') + '"').get().n]))
    for (const file of db.prepare('SELECT id,size FROM files').all()) {
      assert.match(file.id, /^[a-zA-Z0-9_-]+$/, 'Unsafe stored file ID')
      const path = join(root, 'uploads', file.id)
      assert(existsSync(path), 'A database upload is missing')
      assert(!lstatSync(path).isSymbolicLink(), 'Upload symlinks are not supported')
      assert.equal(statSync(path).size, file.size, 'An upload size does not match the database')
    }
  } finally { db.close() }
  const files = []
  function walk(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (directory === root && ['site.sqlite-wal', 'site.sqlite-shm'].includes(name)) continue
      const path = join(directory, name), stat = lstatSync(path)
      assert(!stat.isSymbolicLink(), 'Data symlinks are not supported')
      if (stat.isDirectory()) walk(path)
      else {
        assert(stat.isFile(), 'Unexpected special file in the data directory')
        files.push({ path: relative(root, path).replaceAll('\\', '/'), size: stat.size, sha256: digest(path) })
      }
    }
  }
  walk(root)
  return { format: 1, schema: version, tables, files }
}

export function verifyInventory(directory, expected) {
  assert.equal(expected.format, 1, 'Unsupported inventory format')
  assert.deepEqual(inventory(directory), expected, 'Backup data, file hashes or table counts differ')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, directory, manifest] = process.argv.slice(2)
  assert(directory && manifest && ['create', 'verify'].includes(mode), 'Usage: data-inventory.mjs create|verify DATA_DIR INVENTORY_JSON')
  if (mode === 'create') writeFileSync(manifest, JSON.stringify(inventory(directory), null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  else verifyInventory(directory, JSON.parse(readFileSync(manifest, 'utf8')))
  console.log('Database integrity, table counts and every data-file hash verified')
}
