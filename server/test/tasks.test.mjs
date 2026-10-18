import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { Repository } from '../repository.mjs'
import { publishDueTasks, startTaskScheduler } from '../task-scheduler.mjs'

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

test('scheduled tasks stay private until due, then assign and notify exactly once using publication baseline',async t=>{
  const f=await fixture(t),publish_at=f.time()+60000,deadline=publish_at+86400000
  const id=(await f.call('/tasks','admin','POST',{title:'Scheduled',type:'publish',target:1,reward:10,publish_at,deadline,audience:{kind:'users',ids:['member']}})).data.id
  assert.equal((await f.call('/tasks')).data.items.length,0)
  assert.equal((await f.call('/tasks/reminder')).data.count,0)
  assert.equal(f.db.prepare('SELECT count(*) n FROM task_recipients WHERE task_id=?').get(id).n,0)
  f.article('published');f.advance(59)
  assert.equal((await f.call('/tasks')).data.items.length,0)
  f.advance(1)
  await Promise.all(Array.from({length:8},()=>f.call('/tasks')))
  assert.equal((await f.call('/tasks')).data.items[0].status,'active')
  assert.equal((await f.call('/tasks','other')).data.items.length,0)
  assert.equal((await f.call('/tasks/reminder')).data.count,1)
  assert.equal(f.db.prepare('SELECT count(*) n FROM notifications WHERE event_key=?').get('assigned-task:'+id).n,1)
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,409)
  f.article('published')
  assert.equal((await f.call('/tasks/'+id+'/claim','member','POST',{})).status,200)
  assert.equal(f.db.prepare('SELECT count(*) n FROM experience_ledger WHERE task_id=?').get(id).n,1)
})

test('scheduling validates future times and deadlines, enforces admin and CSRF, and guards stale edits',async t=>{
  const f=await fixture(t),base={title:'Time validation',type:'proof',reward:10,deadline:f.time()+120000}
  for(const publish_at of [f.time(),f.time()-1,'tomorrow',false,base.deadline,base.deadline+1,9e15])assert.equal((await f.call('/tasks','admin','POST',{...base,publish_at})).status,400)
  const id=(await f.call('/tasks','admin','POST',base)).data.id,path='/tasks/'+id+'/schedule',input={publish_at:f.time()+60000,expected_publish_at:null}
  assert.equal((await f.call(path,'member','PATCH',input)).status,403)
  assert.equal((await f.call(path,'admin','PATCH',input,{'X-RD-CSRF':'0'})).status,403)
  assert.equal((await f.call(path,'admin','PATCH',input)).status,200)
  assert.equal((await f.call(path,'admin','PATCH',input)).status,409)
  assert.equal((await f.call(path,'admin','PATCH',{publish_at:null,expected_publish_at:input.publish_at})).status,200)
  f.advance(61)
  assert.equal((await f.call('/tasks')).data.items.length,0)
  assert.equal((await f.call(path,'admin','PATCH',{publish_at:f.time()+30000,expected_publish_at:null})).status,200)
  assert.equal((await f.call('/tasks/'+id+'/status','admin','PATCH',{status:'active'})).status,200)
  assert.equal(f.db.prepare('SELECT publish_at FROM tasks WHERE id=?').get(id).publish_at,null)
  assert.equal((await f.call(path,'admin','PATCH',{publish_at:null,expected_publish_at:null})).status,409)
})

test('worker resolves identities at actual publication, handles restart catch-up and stops cleanly without browser requests',async t=>{
  const f=await fixture(t),repository=new Repository(f.db),publish_at=f.time()+1000
  f.db.prepare("INSERT INTO member_identity(user_id,discipline_id) VALUES('member','art'),('other','programming')").run()
  const id=(await f.call('/tasks','admin','POST',{title:'Later artists',type:'proof',reward:10,publish_at,deadline:publish_at+60000,audience:{kind:'discipline',value:'art'}})).data.id
  f.db.exec("UPDATE member_identity SET discipline_id='programming' WHERE user_id='member'; UPDATE member_identity SET discipline_id='art' WHERE user_id='other'")
  let ticks=0
  const stop=startTaskScheduler(()=>{ticks++;return publishDueTasks(repository,f.time())},10)
  f.advance(2)
  for(let i=0;i<100&&f.db.prepare('SELECT status FROM tasks WHERE id=?').get(id).status!=='active';i++)await new Promise(resolve=>setTimeout(resolve,10))
  stop();const stoppedAt=ticks
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(ticks,stoppedAt)
  assert.equal(f.db.prepare('SELECT user_id FROM task_recipients WHERE task_id=?').get(id).user_id,'other')
  assert.equal(publishDueTasks(repository,f.time()).published,0)
  const next=(await f.call('/tasks','admin','POST',{title:'Restart catch-up',type:'read',target:1,reward:5,publish_at:f.time()+1000})).data.id
  f.advance(2)
  const stopRestart=startTaskScheduler(()=>publishDueTasks(repository,f.time()),1000);stopRestart()
  assert.equal(f.db.prepare('SELECT status FROM tasks WHERE id=?').get(next).status,'active')
})

test('failed scheduled dispatch stays private, rolls back all recipients, notifies admins once and does not block other tasks',async t=>{
  const f=await fixture(t),repository=new Repository(f.db),publish_at=f.time()+1000,deadline=publish_at+1000
  const make=async extra=>(await f.call('/tasks','admin','POST',{title:'Scheduled failure',type:'proof',reward:5,publish_at,deadline:deadline+60000,...extra})).data.id
  const empty=await make({audience:{kind:'office',value:'vice-president'}}),advanced=await make({reward:100,is_advanced:true,audience:{kind:'users',ids:['member']}}),expired=await make({deadline}),good=await make()
  f.advance(3)
  const result=publishDueTasks(repository,f.time())
  assert.equal(result.published,1);assert.equal(result.failed,3);assert.equal(result.errors,0)
  for(const id of [empty,advanced,expired]){const task=f.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);assert.equal(task.status,'draft');assert.equal(task.publish_at,null);assert.ok(task.schedule_error);assert.equal(f.db.prepare('SELECT count(*) n FROM task_recipients WHERE task_id=?').get(id).n,0)}
  assert.equal(f.db.prepare('SELECT status FROM tasks WHERE id=?').get(good).status,'active')
  publishDueTasks(repository,f.time())
  assert.equal(f.db.prepare("SELECT count(*) n FROM notifications WHERE event_key LIKE 'task-schedule-failed:%'").get().n,3)
})

test('revoking the scheduling administrator prevents automatic publication',async t=>{
  const f=await fixture(t),id=(await f.call('/tasks','admin','POST',{title:'Revoked',type:'proof',reward:5,publish_at:f.time()+1000})).data.id
  f.db.exec("UPDATE profiles SET role='admin' WHERE id='other'; UPDATE profiles SET role='user' WHERE id='admin'")
  f.advance(2);assert.equal(publishDueTasks(new Repository(f.db),f.time()).failed,1)
  assert.equal(f.db.prepare('SELECT status FROM tasks WHERE id=?').get(id).status,'draft')
})
test('administrator assignments auto-enroll only recipients, hide private tasks and notify once',async t=>{
  const f=await fixture(t)
  const body={title:'Private custom brief',description:'提交设计方案和演示',type:'proof',target:1,reward:10,deadline:f.time()+86400000,audience:{kind:'users',ids:['member','member']}}
  assert.equal((await f.call('/tasks','member','POST',body)).status,403)
  assert.equal((await f.call('/tasks/audience/preview','member','POST',{audience:body.audience})).status,403)
  assert.equal((await f.call('/tasks/audience/preview','admin','POST',{audience:body.audience})).data.count,1)
  const id=(await f.call('/tasks','admin','POST',body)).data.id
  assert.equal((await f.call('/tasks/reminder')).data.count,0)
  assert.equal((await f.call('/tasks/'+id+'/status','admin','PATCH',{status:'active'})).status,200)
  const mine=(await f.call('/tasks')).data.items[0]
  assert.equal(mine.enrollment.state,'joined');assert.equal(mine.assigned,true);assert.equal('audience' in mine,false)
  assert.equal((await f.call('/tasks','other')).data.items.length,0)
  for(const action of ['join','claim','submit'])assert.equal((await f.call('/tasks/'+id+'/'+action,'other','POST',{note:'unauthorized'})).status,404)
  await f.call('/tasks/'+id+'/status','admin','PATCH',{status:'active'})
  assert.equal(f.db.prepare("SELECT count(*) n FROM notifications WHERE event_key=?").get('assigned-task:'+id).n,1)
  assert.equal(f.db.prepare('SELECT count(*) n FROM task_enrollments WHERE task_id=?').get(id).n,1)
  assert.equal((await f.call('/tasks/reminder',null)).status,401)
})

test('identity audiences snapshot at dispatch and reject invalid or empty recipients atomically',async t=>{
  const f=await fixture(t)
  f.db.prepare("INSERT INTO member_identity(user_id,discipline_id) VALUES('member','art')").run()
  const deadline=f.time()+86400000
  const id=await f.task('proof',{deadline,audience:{kind:'discipline',value:'art'}})
  f.db.prepare("UPDATE member_identity SET discipline_id='programming' WHERE user_id='member'").run()
  f.db.prepare("INSERT INTO member_identity(user_id,discipline_id) VALUES('other','art')").run()
  assert.equal((await f.call('/tasks')).data.items[0].id,id)
  assert.equal((await f.call('/tasks','other')).data.items.length,0)
  for(const audience of [{kind:'level',value:'0'},{kind:'role',value:'member'},{kind:'all'}])assert.ok((await f.call('/tasks/audience/preview','admin','POST',{audience})).data.count>=1)
  for(const audience of [{kind:'users',ids:['missing']},{kind:'role',value:'superadmin'},{kind:'toString'},{kind:'users',ids:[]}])assert.equal((await f.call('/tasks','admin','POST',{title:'Bad',type:'proof',reward:5,deadline,audience})).status,400)
  assert.equal((await f.call('/tasks','admin','POST',{title:'No date',type:'proof',reward:5,audience:{kind:'all'}})).status,400)
  const empty=(await f.call('/tasks','admin','POST',{title:'Empty',type:'proof',reward:5,deadline,audience:{kind:'office',value:'vice-president'}})).data.id
  assert.equal((await f.call('/tasks/'+empty+'/status','admin','PATCH',{status:'active'})).status,409)
  assert.equal(f.db.prepare('SELECT status FROM tasks WHERE id=?').get(empty).status,'draft')
})

test('persistent nearest deadline survives reading messages, expiry and rejection, clears on completion or close',async t=>{
  const f=await fixture(t),deadline=f.time()+10000
  const id=await f.task('proof',{deadline,audience:{kind:'users',ids:['member']}})
  const later=await f.task('proof',{deadline:deadline+100000,audience:{kind:'users',ids:['member']}})
  let reminder=(await f.call('/tasks/reminder')).data
  assert.equal(reminder.nearest.id,id);assert.equal(reminder.count,2);assert.equal(reminder.server_now,f.time())
  f.db.prepare('UPDATE notifications SET read_at=? WHERE user_id=?').run(f.time(),'member')
  assert.equal((await f.call('/tasks/reminder')).data.count,2)
  await f.call('/tasks/'+id+'/submit','member','POST',{note:'Done',url:'',files:[]})
  assert.equal((await f.call('/tasks/reminder')).data.nearest.state,'submitted')
  const review=f.db.prepare('SELECT id FROM task_submissions WHERE task_id=?').get(id)
  await f.call('/tasks/reviews/'+review.id,'admin','POST',{approved:false,note:'补充细节'})
  assert.equal((await f.call('/tasks/reminder')).data.nearest.state,'rejected')
  await f.call('/tasks/'+id+'/submit','member','POST',{note:'Updated',url:'',files:[]})
  const second=f.db.prepare("SELECT id FROM task_submissions WHERE task_id=? AND status='pending'").get(id)
  await f.call('/tasks/reviews/'+second.id,'admin','POST',{approved:true})
  assert.equal((await f.call('/tasks/reminder')).data.nearest.id,later)
  f.advance(200)
  assert.equal((await f.call('/tasks/reminder')).data.count,1)
  await f.call('/tasks/'+later+'/status','admin','PATCH',{status:'closed'})
  assert.equal((await f.call('/tasks/reminder')).data.count,0)
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
