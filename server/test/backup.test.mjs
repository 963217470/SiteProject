import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { inventory, verifyInventory } from '../../deploy/data-inventory.mjs'
import { cryptBackup } from '../../deploy/backup-crypto.mjs'
import { checkCompatibility } from '../../deploy/check-code-compatibility.mjs'

function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'rd-backup-test-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const data=join(root,'data');mkdirSync(join(data,'uploads'),{recursive:true})
  const db=openDatabase(join(data,'site.sqlite'))
  db.prepare("INSERT INTO users(id,github_id,github_username) VALUES('owner','owner','owner')").run()
  db.prepare("INSERT INTO files(id,bucket,path,owner_id,mime,size) VALUES('image','avatars','owner/image','owner','image/png',4)").run()
  db.close();writeFileSync(join(data,'uploads/image'),'1234')
  return {root,data}
}

test('full data inventory verifies schema, table counts and every byte, detecting same-size corruption',t=>{
  const f=fixture(t),snapshot=inventory(f.data)
  assert.equal(snapshot.schema,13);assert.equal(snapshot.tables.files,1)
  verifyInventory(f.data,snapshot)
  writeFileSync(join(f.data,'uploads/image'),'5678')
  assert.throws(()=>verifyInventory(f.data,snapshot),/differ/)
})

test('inventory rejects missing uploads and includes orphan files needed for disaster recovery',t=>{
  const f=fixture(t);writeFileSync(join(f.data,'uploads/orphan'),'keep')
  assert(inventory(f.data).files.some(file=>file.path==='uploads/orphan'))
  rmSync(join(f.data,'uploads/image'))
  assert.throws(()=>inventory(f.data),/missing/)
})

test('authenticated encryption restores bytes and rejects tampering or the wrong key without a partial result',async t=>{
  const f=fixture(t),source=join(f.root,'plain.tgz'),key=join(f.root,'key'),encrypted=join(f.root,'backup.enc')
  const original=randomBytes(1024*1024+17)
  writeFileSync(source,original);writeFileSync(key,randomBytes(32))
  await cryptBackup('encrypt',source,encrypted,key)
  await cryptBackup('decrypt',encrypted,join(f.root,'restored.tgz'),key)
  assert.deepEqual(readFileSync(join(f.root,'restored.tgz')),original)
  await assert.rejects(cryptBackup('decrypt',encrypted,source,key),/exists/)
  const wrong=join(f.root,'wrong');writeFileSync(wrong,randomBytes(32))
  await assert.rejects(cryptBackup('decrypt',encrypted,join(f.root,'wrong.tgz'),wrong))
  assert.equal(existsSync(join(f.root,'wrong.tgz')),false)
  const damaged=readFileSync(encrypted);damaged[35]^=1;writeFileSync(encrypted,damaged)
  await assert.rejects(cryptBackup('decrypt',encrypted,join(f.root,'damaged.tgz'),key))
  assert.equal(existsSync(join(f.root,'damaged.tgz')),false)
})

test('code compatibility checks initialize only an isolated database and leave live data unchanged',async t=>{
  const f=fixture(t),before=inventory(f.data)
  await checkCompatibility(resolve('..'),join(f.data,'site.sqlite'))
  verifyInventory(f.data,before)
  const backend=join(f.root,'older');mkdirSync(join(backend,'server'),{recursive:true})
  writeFileSync(join(backend,'server/database.mjs'),"export function openDatabase(){throw new Error('Database version is newer than this server')}\n")
  await assert.rejects(checkCompatibility(backend,join(f.data,'site.sqlite')),/newer/)
  verifyInventory(f.data,before)
  const changed=join(f.root,'changed');mkdirSync(join(changed,'server'),{recursive:true})
  writeFileSync(join(changed,'server/database.mjs'),"import {DatabaseSync} from 'node:sqlite';export function openDatabase(path){const db=new DatabaseSync(path);db.exec('CREATE TABLE incompatible(id TEXT)');return db}\n")
  await assert.rejects(checkCompatibility(changed,join(f.data,'site.sqlite')),/rollback refused/)
  verifyInventory(f.data,before)
})

test('deployment rollback cannot replace live data with a historical snapshot',()=>{
  const deployment=readFileSync('../scripts/deploy-note-upload.sh','utf8')
  const rollback=deployment.slice(deployment.indexOf('rollback(){'),deployment.indexOf('trap rollback ERR'))
  assert(!rollback.includes('cp -p'))
  assert(!rollback.includes('rm -f'))
  assert(rollback.includes('current_version'))
  assert(deployment.includes('/opt/rd-studio/ops/backup.sh'))
  assert(readFileSync('../scripts/deploy-youthful-frontend.sh','utf8').includes('/opt/rd-studio/ops/backup.sh'))
})
