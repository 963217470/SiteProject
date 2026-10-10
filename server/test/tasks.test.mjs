import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'

async function fixture(t) {
  const db=openDatabase(':memory:'), dataDir=mkdtempSync(join(tmpdir(),'rd-tasks-')), secret='task-test-secret-at-least-thirty-two-characters', cookies={}
  let time=Date.now()
  for(const role of ['admin','member','other']) {
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(role,role,role)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(role,role,role==='other'?'user':role)
    const sid=randomUUID()
    db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:role},cookie:{originalMaxAge:86400000,expires:new Date(Date.now()+86400000),httpOnly:true,path:'/'}}),Date.now()+86400000)
    cookies[role]='rd.sid='+encodeURIComponent('s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''))
  }
  const server=createApp(db,{now:()=>time,dataDir,production:false,sessionSecret:secret,siteUrl:'http://localhost',maxUploadMb:1,adminGithubIds:[]}).listen(0,'127.0.0.1')
  await new Promise(r=>server.once('listening',r))
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();rmSync(dataDir,{recursive:true,force:true})})
  async function call(path,role='member',method='GET',body,extra={}) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'X-RD-CSRF':'1',...(role?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined})
    const result=await response.text();return {status:response.status,data:response.headers.get('content-type')?.includes('json')?JSON.parse(result):result}
  }
  async function task(type='publish',options={}) {
    const result=await call('/tasks','admin','POST',{title:'Task',description:'Test',type,target:1,reward:100,...options});assert.equal(result.status,201)
    const id=result.data.id
    assert.equal((await call('/tasks/'+id+'/status','admin','PATCH',{status:'active'})).status,200)
    return id
  }
  function article(status='pending',owner='member') {const id=randomUUID();db.prepare('INSERT INTO articles(id,title,content,status,author_id) VALUES(?,?,?,?,?)').run(id,'Post','Content',status,owner);return id}
  function file(owner='member',mime='image/png') {const id=randomUUID(),path=owner+'/'+id+'/proof.png';db.prepare("INSERT INTO files(id,bucket,path,owner_id,mime,size) VALUES(?,'task-evidence',?,?,?,4)").run(id,path,owner,mime);writeFileSync(join(dataDir,'uploads',id),'test');return id}
  async function upload(path,role='member') {const response=await fetch(`http://127.0.0.1:${server.address().port}/api/storage/task-evidence/${path}`,{method:'POST',headers:{'X-RD-CSRF':'1',Cookie:cookies[role],'Content-Type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1UAAAAASUVORK5CYII=','base64')});return {status:response.status,data:await response.json()}}
  return {db,call,task,article,file,upload,time:()=>time,advance:seconds=>{time+=seconds*1000}}
}

test('tasks enforce authentication, admin-only creation and hidden drafts',async t=>{
  const f=await fixture(t)
  assert.equal((await f.call('/tasks',null)).status,401)
  assert.equal((await f.call('/tasks','member','POST',{title:'bad'})).status,403)
  await f.call('/tasks','admin','POST',{title:'draft',type:'read',target:2,reward:10})
  assert.equal((await f.call('/tasks')).data.items.length,0)
  assert.equal((await f.call('/tasks','admin')).data.items.length,1)
  assert.equal((await f.call('/tasks/reviews')).status,403)
  assert.equal((await f.call('/data/experience_ledger')).status,404)
  assert.equal((await f.call('/tasks','admin','POST',{title:'bad',type:'publish',target:0,reward:10})).status,400)
})
test('publish tasks exclude old activity and reward concurrent claims once',async t=>{
  const f=await fixture(t),old=f.article('published'),id=await f.task()
  await f.call('/tasks/'+id+'/join','member','POST',{})
  f.db.prepare("UPDATE articles SET status='pending' WHERE id=?").run(old)
  f.db.prepare("UPDATE articles SET status='published' WHERE id=?").run(old)
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,409)
  const fresh=f.article();f.db.prepare("UPDATE articles SET status='published' WHERE id=?").run(fresh)
  const claims=await Promise.all([f.call('/tasks/'+id+'/claim','member','POST',{}),f.call('/tasks/'+id+'/claim','member','POST',{})])
  assert(claims.every(r=>r.status===200))
  assert.equal((await f.call('/tasks/me')).data.xp,110)
  assert.equal((await f.call('/tasks/me')).data.level.title,'见习社员')
  assert.equal(f.db.prepare('SELECT count(*) n FROM experience_ledger').get().n,1)
  assert.equal((await f.call('/tasks/me','other')).data.xp,0)
})
test('reading tasks earn 180 seconds after join and survive history removal',async t=>{
  const f=await fixture(t),article=f.article('published','admin'),id=await f.task('read')
  const start=await f.call('/reading/start','member','POST',{article_id:article}),sid=start.data.id
  await f.call('/reading/'+sid+'/tick','member','POST',{active:true})
  f.advance(15);await f.call('/reading/'+sid+'/tick','member','POST',{active:true})
  await f.call('/tasks/'+id+'/join','member','POST',{})
  for(let i=0;i<11;i++){f.advance(15);await f.call('/reading/'+sid+'/tick','member','POST',{active:true,seconds:9999})}
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,409)
  f.advance(15);await f.call('/reading/'+sid+'/tick','member','POST',{active:true})
  await f.call('/reading/history','member','DELETE',{})
  assert.equal((await f.call('/tasks')).data.items[0].progress,1)
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,200)
})
test('deadline and closed tasks cannot accrue or claim progress',async t=>{
  const f=await fixture(t),id=await f.task('read',{deadline:f.time()+20000}),article=f.article('published')
  await f.call('/tasks/'+id+'/join','member','POST',{})
  const sid=(await f.call('/reading/start','member','POST',{article_id:article})).data.id
  await f.call('/reading/'+sid+'/tick','member','POST',{active:true});f.advance(21)
  await f.call('/reading/'+sid+'/tick','member','POST',{active:true})
  assert.equal(f.db.prepare('SELECT count(*) n FROM task_reads').get().n,0)
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,409)
  assert.equal((await f.call('/tasks/'+id+'/join','other','POST',{})).status,409)
})
test('branch task counts approved requests, not pending requests',async t=>{
  const f=await fixture(t),id=await f.task('branch'),article=f.article()
  await f.call('/tasks/'+id+'/join','member','POST',{})
  f.db.prepare("INSERT INTO knowledge_branch_requests(id,article_id,requester_id,requested_path) VALUES('r',?,'member','程序/基础')").run(article)
  assert.equal((await f.call('/tasks')).data.items[0].progress,0)
  f.db.prepare("UPDATE knowledge_branch_requests SET status='approved' WHERE id='r'").run()
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,200)
})
test('proof rejection requires reason and allows resubmission, approval rewards once',async t=>{
  const f=await fixture(t),id=await f.task('gamejam',{requirements:{image:true,build:true}})
  await f.call('/tasks/'+id+'/join','member','POST',{})
  assert.equal((await f.call('/tasks/'+id+'/submit','member','POST',{note:'done',url:'https://itch.io'})).status,400)
  const image=f.file(),build=f.file('member','application/octet-stream'),body={note:'Game jam entry',url:'https://itch.io/jam/test',files:[image,build]}
  assert.equal((await f.call('/tasks/'+id+'/submit','member','POST',body)).status,201)
  assert.equal((await f.call('/tasks/'+id+'/submit','member','POST',body)).status,409)
  let row=(await f.call('/tasks/reviews','admin')).data.items[0]
  assert.equal((await f.call('/tasks/reviews/'+row.id,'member','POST',{approved:true})).status,403)
  assert.equal((await f.call('/tasks/reviews/'+row.id,'admin','POST',{approved:false})).status,400)
  await f.call('/tasks/reviews/'+row.id,'admin','POST',{approved:false,note:'缺少清晰截图'})
  assert.equal((await f.call('/tasks/me')).data.xp,0)
  await f.call('/tasks/'+id+'/submit','member','POST',body)
  row=(await f.call('/tasks/reviews','admin')).data.items.find(r=>r.status==='pending')
  assert.equal((await f.call('/tasks/reviews/'+row.id,'admin','POST',{approved:true})).status,200)
  assert.equal((await f.call('/tasks/reviews/'+row.id,'admin','POST',{approved:true})).status,409)
  assert.equal((await f.call('/tasks/me')).data.xp,100)
})
test('proof ownership, file privacy, URL validation and retained audit attachments',async t=>{
  const f=await fixture(t),id=await f.task('proof'),file=f.file(),other=f.file('other')
  await f.call('/tasks/'+id+'/join','member','POST',{})
  assert.equal((await f.call('/tasks/'+id+'/submit','member','POST',{note:'done',files:[other]})).status,400)
  assert.equal((await f.call('/tasks/'+id+'/submit','member','POST',{note:'done',url:'javascript:alert(1)'})).status,400)
  await f.call('/tasks/'+id+'/submit','member','POST',{note:'done',files:[file]})
  const path=f.db.prepare('SELECT path FROM files WHERE id=?').get(file).path
  assert.equal((await f.call('/files/task-evidence/'+path,'other')).status,403)
  assert.equal((await f.call('/files/task-evidence/'+path,null)).status,401)
  assert.equal((await f.call('/files/task-evidence/'+path,'admin')).status,200)
  assert.equal((await f.call('/storage/task-evidence','member','DELETE',{prefixes:[path]})).status,409)
})
test('experience cannot be consumed and repeat claims never multiply rewards',async t=>{
  const f=await fixture(t),id=await f.task();await f.call('/tasks/'+id+'/join','member','POST',{})
  const article=f.article();f.db.prepare("UPDATE articles SET status='published' WHERE id=?").run(article)
  await f.call('/tasks/'+id+'/claim','member','POST',{})
  const reward=f.db.prepare('SELECT id FROM experience_ledger').get().id
  assert.equal((await f.call('/tasks/rewards/'+reward+'/reverse','admin','POST',{reason:'审核纠错'})).status,409)
  assert.equal((await f.call('/tasks/me')).data.xp,110)
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,200)
  assert.equal((await f.call('/tasks/rewards/'+reward+'/reverse','admin','POST',{reason:'again'})).status,409)
  assert.throws(()=>f.db.exec('DELETE FROM experience_ledger'))
})
test('discipline and appointed offices never change permission roles',async t=>{
  const f=await fixture(t)
  await f.call('/tasks/identity','member','PUT',{discipline_id:'programming',office:'president',xp:9999})
  assert.equal((await f.call('/tasks/people/member','member','PUT',{office:'president'})).status,403)
  await f.call('/tasks/people/member','admin','PUT',{office:'president'})
  const me=(await f.call('/tasks/me')).data
  assert.equal(me.identity.office,'president');assert.equal(me.role,'member');assert.equal(me.xp,0)
  assert.equal((await f.call('/tasks/levels','admin','PUT',{levels:[{threshold:0,title:'a'},{threshold:0,title:'b'}]})).status,400)
})

test('proof uploads validate ownership, return usable IDs and enforce quota',async t=>{
  const f=await fixture(t)
  assert.equal((await f.upload('other/forged.png')).status,403)
  const uploaded=await f.upload('member/new.png')
  assert.equal(uploaded.status,201);assert(uploaded.data.id);assert.equal(uploaded.data.mime,'image/png')
  const id=await f.task('proof',{requirements:{image:true}})
  await f.call('/tasks/'+id+'/join','member','POST',{})
  assert.equal((await f.call('/tasks/'+id+'/submit','member','POST',{note:'Done',files:[uploaded.data.id]})).status,201)
  f.db.prepare('UPDATE files SET size=? WHERE id=?').run(500*1024*1024,uploaded.data.id)
  assert.equal((await f.upload('member/too-many.png')).status,413)
  assert.equal((await f.call('/tasks/identity','member','PUT',{discipline_id:'art'},{Origin:'https://evil.example'})).status,403)
})
