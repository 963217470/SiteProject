import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID,createHmac } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { communityDay,nextReset,creditDailyReading,experience,flushCommunity } from '../community.mjs'
import {activityWeek} from '../activity.mjs'

test('weekly activity uses Beijing Monday boundaries, excludes old/future EXP and retains last week',async t=>{
  const f=await fixture(t),monday=Date.parse('2026-10-11T16:00:00Z')
  assert.equal(activityWeek(monday),monday)
  assert.equal(activityWeek(monday-1),monday-7*86400000)
  const add=(id,user,amount,at)=>f.db.prepare('INSERT INTO community_experience VALUES(?,?,?,?,?,?)').run(id,user,id,amount,'Activity',at)
  add('sun','admin',10,monday-1);add('mon','member',5,monday);add('future','other',999,monday+7*86400000)
  f.set(monday)
  const current=await f.call('/activity/weekly',null)
  assert.equal(current.status,200);assert.equal(current.data.week_start,'2026-10-12');assert.equal(current.data.week_end,'2026-10-18')
  assert.deepEqual(current.data.items.map(p=>[p.id,p.weekly_exp]),[['member',5]])
  assert.equal(current.data.next_week,null);assert.equal(current.data.own,null)
  const previous=(await f.call('/activity/weekly?week=2026-10-05',null)).data
  assert.deepEqual(previous.items.map(p=>[p.id,p.weekly_exp]),[['admin',10]])
  assert.equal(previous.next_week,'2026-10-12')
})

test('weekly ranking counts task rewards plus daily EXP, gives tied ranks and exposes no private account data',async t=>{
  const f=await fixture(t),at=f.time()
  f.db.prepare("INSERT INTO community_experience VALUES('one','member','one',20,'Daily',?),('two','other','two',20,'Daily',?),('old','admin','old',50000,'Old',?)").run(at,at,at-14*86400000)
  const task=(await f.call('/tasks','admin','POST',{title:'Proof',description:'Proof',type:'proof',target:1,reward:100,requirements:{}})).data.id
  f.db.prepare("INSERT INTO task_enrollments(task_id,user_id,joined_at,activity_baseline) VALUES(?,'member',?,0)").run(task,at)
  f.db.prepare("INSERT INTO experience_ledger(id,task_id,user_id,amount,created_at,created_by,reason) VALUES('reward',?,'member',100,?,'admin','Task')").run(task,at)
  const ranked=(await f.call('/activity/weekly')).data
  assert.equal(ranked.total,2);assert.equal(ranked.own.weekly_exp,120);assert.equal(ranked.own.rank,1)
  assert.deepEqual(ranked.items.map(p=>p.id),['member','other'])
  f.db.prepare("INSERT INTO community_experience VALUES('tie','other','tie',100,'Task equivalent',?)").run(at)
  assert.deepEqual((await f.call('/activity/weekly',null)).data.items.map(p=>p.rank),[1,1])
  const profile=(await f.call('/activity/weekly',null)).data.items[0]
  assert.deepEqual(Object.keys(profile).sort(),['avatar_url','id','rank','username','weekly_exp'])
  assert.equal((await f.call('/activity/weekly','admin')).data.own.weekly_exp,0)
})

test('weekly pagination and date validation reject invalid or future weeks',async t=>{
  const f=await fixture(t)
  for(const query of ['week=2026-10-06','week=2026-02-30','week=2099-01-05','week=bad','limit=0','limit=51','offset=-1'])assert.equal((await f.call('/activity/weekly?'+query,null)).status,400,query)
  f.db.prepare("INSERT INTO community_experience VALUES('a','member','a',5,'Daily',?),('b','other','b',5,'Daily',?)").run(f.time(),f.time())
  const first=(await f.call('/activity/weekly?limit=1',null)).data
  const second=(await f.call('/activity/weekly?limit=1&offset=1',null)).data
  assert.equal(first.has_more,true);assert.equal(second.has_more,false);assert.notEqual(first.items[0].id,second.items[0].id)
})

test('concurrent first visits and repeated checkins award only once with authoritative day metadata',async t=>{
  const f=await fixture(t)
  const attempts=await Promise.all(Array.from({length:4},()=>f.call('/community/checkin','member','POST',{xp:999,user_id:'other'})))
  assert.equal(attempts.filter(r=>r.data.already===false).length,1)
  assert.equal(experience(f.db,'member'),5);assert.equal(experience(f.db,'other'),0)
  for(const result of attempts){assert.equal(result.data.day,communityDay(f.time()));assert.equal(result.data.reset_at,nextReset(f.time()));assert.equal(result.data.server_time,f.time())}
})

async function fixture(t){
  const db=openDatabase(':memory:'),dataDir=mkdtempSync(join(tmpdir(),'rd-community-')),cookies={},secret=randomUUID()+randomUUID()
  let time=Date.parse('2026-10-10T04:00:00Z')
  for(const role of ['admin','member','other']){
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(role,role,role)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(role,role,role==='other'?'user':role)
    const sid=randomUUID();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:role},cookie:{expires:new Date(Date.now()+86400000),httpOnly:true,path:'/'}}),Date.now()+86400000)
    cookies[role]='rd.sid='+encodeURIComponent('s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''))
  }
  const server=createApp(db,{now:()=>time,dataDir,production:false,sessionSecret:secret,siteUrl:'http://localhost',maxUploadMb:1,adminGithubIds:[]}).listen(0,'127.0.0.1')
  await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));db.close();rmSync(dataDir,{recursive:true,force:true})})
  async function call(path,role='member',method='GET',body){const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'X-RD-CSRF':'1',...(role?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:res.status,data:await res.json()}}
  const article=(owner='admin',status='published')=>{const id=randomUUID();db.prepare('INSERT INTO articles(id,title,content,status,author_id) VALUES(?,?,?,?,?)').run(id,'Post','Body',status,owner);return id}
  return{db,call,article,time:()=>time,set:at=>{time=at},advance:ms=>{time+=ms}}
}

test('admin overview and merged queue enforce role, include every review type and support safe filters',async t=>{
  const f=await fixture(t);f.article('member','pending');f.article('member','draft')
  assert.equal((await f.call('/admin/overview',null)).status,401)
  assert.equal((await f.call('/admin/overview','member')).status,403)
  const overview=(await f.call('/admin/overview','admin')).data
  assert.equal(overview.queues.length,6);assert.equal(overview.pending,1)
  const queue=await f.call('/admin/queue','admin');assert.equal(queue.status,200);assert.equal(queue.data.items.length,1)
  assert.equal(queue.data.items[0].kind,'article');assert.equal(queue.data.items[0].username,'member')
  assert.equal((await f.call('/admin/queue?kind=article&q=Post','admin')).data.items.length,1)
  assert.equal((await f.call('/admin/queue?kind=invalid','admin')).status,400)
  assert.equal((await f.call('/admin/activity','member')).status,403)
  assert.equal((await f.call('/data/profiles?id=eq.admin','admin','PATCH',{role:'user'})).status,409)
  assert.equal(f.db.prepare("SELECT role FROM profiles WHERE id='admin'").get().role,'admin')
})

test('admin announcements are confirmed, scoped, idempotent and do not accept unsafe navigation',async t=>{
  const f=await fixture(t),body={request_key:'notice-one',title:'活动通知',body:'本周交流',href:'/tasks/',audience:'all'}
  assert.equal((await f.call('/admin/notices','member','POST',body)).status,403)
  assert.equal((await f.call('/admin/notice-preview','admin','POST',body)).data.recipient_count,3)
  const first=await f.call('/admin/notices','admin','POST',body);assert.equal(first.status,200);assert.equal(first.data.recipient_count,3)
  const again=await f.call('/admin/notices','admin','POST',body);assert.equal(again.data.reused,true)
  assert.equal(f.db.prepare("SELECT count(*) n FROM notifications WHERE category='announcement'").get().n,3)
  assert.equal((await f.call('/admin/notices','admin','POST',{...body,title:'Changed'})).status,409)
  assert.equal((await f.call('/admin/notices','admin','POST',{...body,request_key:'evil',href:'//evil.example'})).status,400)
  assert.equal((await f.call('/admin/notice-preview','admin','POST',{audience:'formal'})).data.recipient_count,1)
  const one=await f.call('/admin/notices','admin','POST',{...body,request_key:'one-user',audience:'user',user_id:'member'})
  assert.equal(one.data.recipient_count,1)
  assert.equal((await f.call('/messages?category=announcement','other')).data.items.length,1)
  assert.equal((await f.call('/admin/activity','admin')).data.items.filter(a=>a.action==='发送通知').length,2)
})

test('profile approval atomically updates public data, records the actor and cannot be repeated',async t=>{
  const f=await fixture(t)
  const created=await f.call('/data/profile_changes','member','POST',{username:'New name',bio:'New bio'})
  const id=created.data[0].id
  assert.equal((await f.call('/admin/profile/'+id+'/review','member','POST',{approved:true})).status,403)
  assert.equal((await f.call('/admin/profile/'+id+'/review','admin','POST',{approved:false})).status,400)
  assert.equal((await f.call('/admin/profile/'+id+'/review','admin','POST',{approved:true})).status,200)
  assert.equal(f.db.prepare("SELECT username FROM profiles WHERE id='member'").get().username,'New name')
  assert.equal(f.db.prepare('SELECT reviewed_by FROM profile_changes WHERE id=?').get(id).reviewed_by,'admin')
  assert.equal((await f.call('/admin/profile/'+id+'/review','admin','POST',{approved:true})).status,409)
  assert.equal((await f.call('/messages?category=result')).data.items.filter(n=>n.title.includes('资料修改审核通过')).length,1)
})

test('branch review is atomic on failure, binds original creator and never publishes a draft',async t=>{
  const f=await fixture(t),article=f.article('member','draft')
  const request=await f.call('/data/knowledge_branch_requests','member','POST',{article_id:article,requested_path:'Root / New branch',requested_description:'Branch explanation'})
  const id=request.data[0].id
  f.db.exec("CREATE TEMP TRIGGER simulate_approval_failure BEFORE UPDATE ON knowledge_branch_requests WHEN NEW.status='approved' BEGIN SELECT RAISE(ABORT,'test rollback'); END;")
  assert.notEqual((await f.call('/admin/branch/'+id+'/review','admin','POST',{approved:true})).status,200)
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_branches').get().n,0)
  assert.equal(f.db.prepare('SELECT kb_enabled FROM articles WHERE id=?').get(article).kb_enabled,0)
  f.db.exec('DROP TRIGGER simulate_approval_failure')
  assert.equal((await f.call('/admin/branch/'+id+'/review','admin','POST',{approved:true})).status,200)
  const branch=f.db.prepare("SELECT * FROM knowledge_branches WHERE name='New branch'").get()
  assert.equal(branch.created_by,'member');assert.equal(branch.description,'Branch explanation')
  const note=f.db.prepare('SELECT * FROM articles WHERE id=?').get(article)
  assert.equal(note.status,'draft');assert.equal(note.kb_branch_id,branch.id)
  assert.equal((await f.call('/admin/branch/'+id+'/review','admin','POST',{approved:true})).status,409)
})

test('interaction notifications arrive only after approval and do not notify the commenter about themselves',async t=>{
  const f=await fixture(t),article=f.article('admin')
  const comment=await f.call('/comments','member','POST',{article_id:article,content:'First'})
  assert.equal((await f.call('/messages?category=interaction','admin')).data.items.length,0)
  await f.call('/comments/'+comment.data.id+'/review','admin','POST',{approved:true})
  assert.equal((await f.call('/messages?category=interaction','admin')).data.items.length,1)
  const reply=await f.call('/comments','other','POST',{article_id:article,parent_id:comment.data.id,content:'Reply'})
  assert.equal((await f.call('/messages?category=interaction','member')).data.items.length,0)
  await f.call('/comments/'+reply.data.id+'/review','admin','POST',{approved:true})
  assert.equal((await f.call('/messages?category=interaction','member')).data.items.length,1)
  assert.equal((await f.call('/messages?category=interaction','other')).data.items.length,0)
})

test('message filters, read watermark and archive/restore are scoped to the recipient',async t=>{
  const f=await fixture(t)
  await f.call('/admin/notices','admin','POST',{request_key:'n1',title:'One',body:'One',audience:'all'})
  const inbox=(await f.call('/messages')).data,id=inbox.items[0].id
  assert.equal((await f.call('/messages/read','member','POST',{id:''})).status,400)
  assert.equal((await f.call('/messages/unread')).data.unread,1)
  assert.equal((await f.call('/messages/'+id+'/archive','other','POST',{})).status,404)
  await f.call('/messages/'+id+'/archive','member','POST',{})
  assert.equal((await f.call('/messages/unread')).data.unread,0)
  assert.equal((await f.call('/messages?state=archived')).data.items.length,1)
  await f.call('/messages/'+id+'/restore','member','POST',{})
  await f.call('/admin/notices','admin','POST',{request_key:'n2',title:'Two',body:'Two',audience:'all'})
  await f.call('/messages/read','member','POST',{before:inbox.sync_at,cursor:inbox.sync_cursor})
  assert.equal((await f.call('/messages?state=unread')).data.items.length,1)
  assert.equal((await f.call('/messages?category=invalid')).status,400)
})

test('checkin is authenticated, once daily, Beijing midnight, consecutive bonus and gap reset',async t=>{
  const f=await fixture(t)
  assert.equal((await f.call('/community/checkin',null,'POST',{})).status,401)
  for(let day=1;day<=7;day++){
    const first=await f.call('/community/checkin','member','POST',{xp:99999,streak:999})
    assert.equal(first.data.streak,day);assert.equal(first.data.reward,day===7?10:5)
    assert.equal((await f.call('/community/checkin','member','POST',{})).data.reward,0)
    if(day!==7)f.advance(86400000)
  }
  assert.equal(experience(f.db,'member'),40)
  assert.equal((await f.call('/community/daily')).data.tasks.filter(x=>x.done).length,2)
  f.advance(2*86400000);assert.equal((await f.call('/community/checkin','member','POST',{})).data.streak,1)
  f.set(Date.parse('2026-10-20T15:59:59Z'));await f.call('/community/checkin','member','POST',{})
  f.advance(1000);assert.equal((await f.call('/community/daily')).data.checked_in,false)
  assert.equal((await f.call('/community/checkin','member','POST',{})).data.streak,2)
  assert.equal(communityDay(f.time()),'2026-10-21');assert.equal(nextReset(f.time()),Date.parse('2026-10-21T16:00:00Z'))
})

test('comments and replies require review, bind author, reward approval only and cascade takedown',async t=>{
  const f=await fixture(t),article=f.article()
  const comment=await f.call('/comments','member','POST',{article_id:article,content:'Hello <script>',user_id:'admin',status:'approved'})
  assert.equal(comment.status,201);assert.equal(experience(f.db,'member'),0)
  assert.equal((await f.call('/comments?article_id='+article,null)).data.items.length,0)
  assert.equal((await f.call('/comments?article_id='+article)).data.items[0].user_id,'member')
  assert.equal((await f.call('/comments/'+comment.data.id+'/review','member','POST',{approved:true})).status,403)
  assert.equal((await f.call('/comments','other','POST',{article_id:article,parent_id:comment.data.id,content:'reply'})).status,400)
  await f.call('/comments/'+comment.data.id+'/review','admin','POST',{approved:true})
  assert.equal(experience(f.db,'member'),5)
  const reply=await f.call('/comments','member','POST',{article_id:article,parent_id:comment.data.id,content:'Reply'})
  await f.call('/comments/'+reply.data.id+'/review','admin','POST',{approved:true})
  assert.equal(experience(f.db,'member'),5)
  assert.equal(f.db.prepare('SELECT comments_count n FROM articles WHERE id=?').get(article).n,2)
  assert.equal((await f.call('/comments/'+reply.data.id+'/review','admin','POST',{approved:true})).status,409)
  await f.call('/comments/'+comment.data.id+'/review','admin','POST',{approved:false,note:'Moderation'})
  assert.equal((await f.call('/comments?article_id='+article,null)).data.items.length,0)
  assert.equal(f.db.prepare('SELECT comments_count n FROM articles WHERE id=?').get(article).n,0)
  assert.equal(experience(f.db,'member'),5)
  assert.equal((await f.call('/data/comments?id=eq.'+comment.data.id,'member','PATCH',{content:'edited'})).status,403)
})

test('daily publication only rewards first publication and once per day, never resubmission',async t=>{
  const f=await fixture(t),one=f.article('member','pending'),two=f.article('member','pending')
  await f.call('/messages');assert.equal(experience(f.db,'member'),0)
  for(const id of [one,two])await f.call('/data/articles?id=eq.'+id,'admin','PATCH',{status:'published'})
  assert.equal(experience(f.db,'member'),10)
  f.advance(86400000)
  await f.call('/data/articles?id=eq.'+one,'admin','PATCH',{status:'pending'})
  await f.call('/data/articles?id=eq.'+one,'admin','PATCH',{status:'published'})
  assert.equal(experience(f.db,'member'),10)
  const fresh=f.article('member','pending');await f.call('/data/articles?id=eq.'+fresh,'admin','PATCH',{status:'published'})
  assert.equal(experience(f.db,'member'),20)
})

test('daily reading needs 150 validated seconds of a single published article, clears do not reset reward',async t=>{
  const f=await fixture(t),article=f.article()
  const sid=(await f.call('/reading/start','member','POST',{article_id:article})).data.id
  await f.call('/reading/'+sid+'/tick','member','POST',{active:true})
  for(let n=0;n<9;n++){f.advance(15000);await f.call('/reading/'+sid+'/tick','member','POST',{active:true,seconds:10000})}
  assert.equal(experience(f.db,'member'),0)
  f.advance(15000);await f.call('/reading/'+sid+'/tick','member','POST',{active:true})
  assert.equal(experience(f.db,'member'),5)
  await f.call('/reading/history','member','DELETE',{})
  creditDailyReading(f.db,'member',f.article(),150,f.time());assert.equal(experience(f.db,'member'),5)
  creditDailyReading(f.db,'other',f.article('other','draft'),150,f.time());assert.equal(experience(f.db,'other'),0)
})

test('reading midnight intervals are split, not carried over',async t=>{
  const f=await fixture(t),id=f.article(),midnight=Date.parse('2026-10-10T16:00:00Z')
  creditDailyReading(f.db,'member',id,140,midnight-5000)
  creditDailyReading(f.db,'member',id,15,midnight+10000)
  const rows=f.db.prepare('SELECT day,seconds FROM daily_reads WHERE user_id=? ORDER BY day').all('member')
  assert.deepEqual(rows.map(r=>r.seconds),[145,10]);assert.equal(experience(f.db,'member'),0)
})

test('levels, advanced eligibility, admin EXP and private message read scope',async t=>{
  const f=await fixture(t)
  f.db.prepare('INSERT INTO community_experience VALUES(?,?,?,?,?,?)').run(randomUUID(),'member','seed',50,'test',f.time())
  assert.equal((await f.call('/tasks/me')).data.level.title,'见习社员')
  assert.equal((await f.call('/community/daily')).data.advanced_unlocked,true)
  const messages=(await f.call('/messages')).data
  assert.equal(messages.items.filter(m=>m.title.includes('升级')).length,1)
  await f.call('/messages/read','other','POST',{id:messages.items[0].id})
  assert.equal((await f.call('/messages')).data.unread,1)
  await f.call('/messages/read','member','POST',{})
  assert.equal((await f.call('/messages')).data.unread,0)
  assert.equal((await f.call('/tasks/people','member')).status,403)
  assert.equal((await f.call('/tasks/people','admin')).data.find(x=>x.id==='member').xp,50)
  const task=(await f.call('/tasks','admin','POST',{title:'Advanced',type:'proof',target:1,reward:100,is_advanced:true})).data.id
  await f.call('/tasks/'+task+'/status','admin','PATCH',{status:'active'})
  assert.equal((await f.call('/tasks/'+task+'/join','other','POST',{})).status,403)
  assert.equal((await f.call('/tasks/'+task+'/join','member','POST',{})).status,200)
  await f.call('/tasks/'+task+'/submit','member','POST',{note:'Done',files:[]})
  const proof=f.db.prepare('SELECT id FROM task_submissions').get().id
  await f.call('/tasks/reviews/'+proof,'admin','POST',{approved:true})
  assert.equal(experience(f.db,'member'),150)
  f.db.prepare('INSERT INTO community_experience VALUES(?,?,?,?,?,?)').run(randomUUID(),'member','seed2',150,'test',f.time())
  assert.equal((await f.call('/tasks/me')).data.level.title,'正式社员')
  f.db.prepare('INSERT INTO community_experience VALUES(?,?,?,?,?,?)').run(randomUUID(),'member','seed3',200,'test',f.time())
  assert.equal((await f.call('/tasks/me')).data.level.title,'资深社员')
  assert.throws(()=>f.db.exec('DELETE FROM community_experience'))
})

test('every submission type notifies administrators and takedowns notify authors',async t=>{
  const f=await fixture(t),id=f.article('member','pending')
  await f.call('/data/profile_changes','member','POST',{username:'changed'})
  await f.call('/data/knowledge_branch_requests','member','POST',{article_id:id,requested_path:'Branch'})
  const publicId=f.article();await f.call('/comments','member','POST',{article_id:publicId,content:'Comment'})
  assert.equal((await f.call('/catalog','member','POST',{kind:'tool',title:'Tool',content:'Body',assets:[],status:'pending',external_url:'https://example.com/tool'})).status,201)
  const labels=(await f.call('/messages','admin')).data.items.map(m=>m.title)
  for(const label of ['文章','资料修改','知识库申请','评论','游戏/工具作品'])assert(labels.some(title=>title.includes(label)),label)
  await f.call('/data/articles?id=eq.'+id,'admin','PATCH',{status:'published'})
  await f.call('/data/articles?id=eq.'+id,'admin','PATCH',{status:'rejected',reject_reason:'Withdraw'})
  assert((await f.call('/messages')).data.items.some(m=>m.title.includes('撤回')))
  flushCommunity(f.db,()=>f.time());assert.equal(experience(f.db,'member'),10)
})
