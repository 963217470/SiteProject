import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../database.mjs'

test('version 1 migrates without data loss and reopening version 4 is idempotent', t => {
  const dir = mkdtempSync(join(tmpdir(), 'rd-migration-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'site.sqlite')
  const old = new DatabaseSync(file)
  old.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'))
  old.exec("INSERT INTO users(id,github_id,github_username) VALUES('one','1','one'); PRAGMA user_version=1")
  old.close()
  let db = openDatabase(file)
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 4)
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1)
  assert(db.prepare("SELECT name FROM sqlite_master WHERE name='reading_history'").get())
  db.close()
  db = openDatabase(file)
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1)
  db.close()
})

test('version 2 task migration backfills prior activity and keeps reading history', t => {
  const dir = mkdtempSync(join(tmpdir(), 'rd-task-migration-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'site.sqlite'), old = new DatabaseSync(file)
  old.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'))
  old.exec(readFileSync(new URL('../migrations/002-reading.sql', import.meta.url), 'utf8'))
  old.exec("INSERT INTO users(id,github_id,github_username) VALUES('one','1','one'); INSERT INTO articles(id,title,content,status,author_id) VALUES('a','Post','Body','published','one'); INSERT INTO reading_history(user_id,article_id,seconds,last_read_at) VALUES('one','a',180,'2026-10-09'); PRAGMA user_version=2")
  old.close()
  const db = openDatabase(file)
  assert.equal(db.prepare('SELECT seconds FROM reading_history').get().seconds, 180)
  assert.equal(db.prepare("SELECT count(*) n FROM task_activity WHERE kind='publish'").get().n, 1)
  db.exec("UPDATE articles SET status='pending' WHERE id='a'; UPDATE articles SET status='published' WHERE id='a'")
  assert.equal(db.prepare('SELECT count(*) n FROM task_activity').get().n, 1)
  const snapshot = join(dir, 'snapshot.sqlite')
  db.prepare('VACUUM INTO ?').run(snapshot)
  const restored = new DatabaseSync(snapshot)
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
  restored.close(); db.close()
})

test('schema 3 catalog migration preserves member roles, tasks and experience',t=>{
  const dir=mkdtempSync(join(tmpdir(),'rd-catalog-migration-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const file=join(dir,'site.sqlite'),old=new DatabaseSync(file)
  for(const path of ['../schema.sql','../migrations/002-reading.sql','../migrations/003-tasks.sql'])old.exec(readFileSync(new URL(path,import.meta.url),'utf8'))
  old.exec("INSERT INTO users(id,github_id,github_username) VALUES('one','1','one'); INSERT INTO profiles(id,username,role) VALUES('one','one','admin'); INSERT INTO tasks(id,title,description,type,target,reward,status,created_by,created_at) VALUES('task','Task','','publish',1,100,'active','one',1); PRAGMA user_version=3")
  old.close();const db=openDatabase(file)
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,4)
  assert.equal(db.prepare('SELECT role FROM profiles').get().role,'admin')
  assert.equal(db.prepare('SELECT count(*) n FROM tasks').get().n,1)
  assert.equal(db.prepare('SELECT count(*) n FROM experience_levels').get().n,5)
  assert.equal(db.prepare('SELECT count(*) n FROM catalog_items').get().n,0)
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close()
})
