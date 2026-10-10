import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID,createHmac } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { communityDay,nextReset,creditDailyReading,experience,flushCommunity } from '../community.mjs'

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
