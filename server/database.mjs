import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import session from 'express-session'

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path)
  db.function('rd_now', Date.now)
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
  const version = db.prepare('PRAGMA user_version').get().user_version
  if (version > 15) { db.close(); throw new Error('Database version is newer than this server') }
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
    if (version < 2) db.exec(readFileSync(new URL('./migrations/002-reading.sql', import.meta.url), 'utf8'))
    if (version < 3) db.exec(readFileSync(new URL('./migrations/003-tasks.sql', import.meta.url), 'utf8'))
    if (version < 4) db.exec(readFileSync(new URL('./migrations/004-catalog.sql', import.meta.url), 'utf8'))
    if (version < 5) db.exec(readFileSync(new URL('./migrations/005-community.sql', import.meta.url), 'utf8'))
    if (version < 6) db.exec(readFileSync(new URL('./migrations/006-note-upload.sql', import.meta.url), 'utf8'))
    if (version < 7) db.exec(readFileSync(new URL('./migrations/007-knowledge-positions.sql', import.meta.url), 'utf8'))
    if (version < 8) db.exec(readFileSync(new URL('./migrations/008-mcp-knowledge.sql', import.meta.url), 'utf8'))
    if (version < 9) db.exec(readFileSync(new URL('./migrations/009-admin-messages.sql', import.meta.url), 'utf8'))
    if (version < 10) db.exec(readFileSync(new URL('./migrations/010-task-assignments.sql', import.meta.url), 'utf8'))
    if (version < 11) db.exec(readFileSync(new URL('./migrations/011-knowledge-connections.sql', import.meta.url), 'utf8'))
    if (version < 12) db.exec(readFileSync(new URL('./migrations/012-task-schedules.sql', import.meta.url), 'utf8'))
    if (version < 13) db.exec(readFileSync(new URL('./migrations/013-shop.sql', import.meta.url), 'utf8'))
    if (version < 14) db.exec(readFileSync(new URL('./migrations/014-pause-currency.sql', import.meta.url), 'utf8'))
    if (version < 15) db.exec(readFileSync(new URL('./migrations/015-catalog-download-links.sql', import.meta.url), 'utf8'))
    db.exec('PRAGMA user_version=15; COMMIT')
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error }
  return db
}

export class SQLiteSessionStore extends session.Store {
  constructor(db) { super(); this.db = db }
  get(sid, callback) {
    try {
      const row = this.db.prepare('SELECT data FROM sessions WHERE sid=? AND expires>?').get(sid, Date.now())
      callback(null, row ? JSON.parse(row.data) : null)
    } catch (error) { callback(error) }
  }
  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 86400000
      this.db.prepare('INSERT OR REPLACE INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid, JSON.stringify(value), expires)
      this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())
      callback()
    } catch (error) { callback(error) }
  }
  destroy(sid, callback = () => {}) {
    try { this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); callback() }
    catch (error) { callback(error) }
  }
  touch(sid, value, callback) { this.set(sid, value, callback) }
}
