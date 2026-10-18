import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function checkCompatibility(backend, database) {
  const folder = mkdtempSync(join(tmpdir(), 'rd-compatibility-'))
  const schema = db => JSON.stringify({ version: db.prepare('PRAGMA user_version').get().user_version, objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all() })
  try {
    const live = new DatabaseSync(database, { readOnly: true })
    let before
    try { before = schema(live); live.prepare('VACUUM INTO ?').run(join(folder, 'clone.sqlite')) } finally { live.close() }
    const { openDatabase } = await import(pathToFileURL(join(resolve(backend), 'server/database.mjs')))
    const clone = openDatabase(join(folder, 'clone.sqlite'))
    try {
      assert.equal(schema(clone), before, 'Target code changes the current schema; code-only rollback refused')
      assert.deepEqual(clone.prepare('PRAGMA integrity_check').all().map(row => row.integrity_check), ['ok'])
    } finally { clone.close() }
  } finally { rmSync(folder, { recursive: true, force: true }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2] && process.argv[3], 'Usage: check-code-compatibility.mjs BACKEND_RELEASE DATABASE')
  await checkCompatibility(process.argv[2], process.argv[3])
  console.log('Target database initialization preserves the current schema on an isolated clone')
}
