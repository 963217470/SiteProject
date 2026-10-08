import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database.mjs'

test('version 1 migrates without data loss and reopening version 2 is idempotent', t => {
  const dir = mkdtempSync(join(tmpdir(), 'rd-migration-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'site.sqlite')
  const old = new DatabaseSync(file)
  old.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'))
  old.exec("INSERT INTO users(id,github_id,github_username) VALUES('one','1','one'); PRAGMA user_version=1")
  old.close()
  let db = openDatabase(file)
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2)
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1)
  assert(db.prepare("SELECT name FROM sqlite_master WHERE name='reading_history'").get())
  db.close()
  db = openDatabase(file)
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1)
  db.close()
})
