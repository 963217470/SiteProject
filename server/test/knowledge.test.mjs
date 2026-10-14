import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { Repository } from '../repository.mjs'

async function fixture(t) {
  const dataDir=mkdtempSync(join(tmpdir(),'rd-knowledge-'))
  const db=openDatabase(':memory:'),ids={},cookies={}
  const secret='knowledge-test-session-secret-32-characters'
  for(const role of ['author','other','admin']) {
    const id=randomUUID(),sid=randomUUID();ids[role]=id
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(id,role,role)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(id,role,role==='admin'?'admin':'user')
    db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:id},cookie:{httpOnly:true,path:'/',expires:new Date(Date.now()+86400000)}}),Date.now()+86400000)
    cookies[role]='rd.sid='+encodeURIComponent('s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''))
  }
  const server=createApp(db,{dataDir,production:false,sessionSecret:secret,siteUrl:'https://rd-studio.club',maxUploadMb:5,adminGithubIds:[]}).listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  const base='http://127.0.0.1:'+server.address().port
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dataDir,{recursive:true,force:true})})
  async function call(path,{method='GET',role,body,headers={}}={}) {
    const response=await fetch(base+'/api'+path,{method,headers:{'X-RD-CSRF':'1',...(role?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined})
    return {status:response.status,body:await response.json()}
  }
  function branch(owner='author',parent=null,slug=randomUUID()) {
    const id=randomUUID();db.prepare('INSERT INTO knowledge_branches(id,name,slug,parent_id,created_by) VALUES(?,?,?,?,?)').run(id,'Branch',slug,parent,owner?ids[owner]:null);return id
  }
  function article(owner='author',parent=null,visibility='public',status='published') {
    const id=randomUUID();db.prepare('INSERT INTO articles(id,title,content,author_id,kb_enabled,kb_branch_id,visibility,status) VALUES(?,?,?,?,1,?,?,?)').run(id,'Note','Original Markdown',ids[owner],parent,visibility,status);return id
  }
  return {db,ids,call,branch,article}
}

test('creator and admin deletion enforce ownership, retain descendants and articles, and protect root',async t=>{
  const f=await fixture(t),parent=f.branch('admin'),own=f.branch('author',parent),child=f.branch('other',own),note=f.article('other',own)
  const path='/knowledge/nodes/b:'+own
  assert.equal((await f.call(path,{method:'DELETE'})).status,401)
  assert.equal((await f.call(path,{method:'DELETE',role:'other'})).status,403)
  const removed=await f.call(path,{method:'DELETE',role:'author'})
  assert.equal(removed.status,200);assert.equal(removed.body.parent,'b:'+parent)
  assert.equal(f.db.prepare('SELECT parent_id FROM knowledge_branches WHERE id=?').get(child).parent_id,parent)
  const article=f.db.prepare('SELECT * FROM articles WHERE id=?').get(note)
  assert.equal(article.kb_branch_id,parent);assert.equal(article.status,'published');assert.equal(article.content,'Original Markdown')
  assert.equal((await f.call('/knowledge/nodes/b:'+child,{method:'DELETE',role:'admin'})).status,200)
  assert.equal((await f.call('/knowledge/nodes/root',{method:'DELETE',role:'admin'})).status,400)
})

test('branch deletion through the legacy API has the same creator scope and no cascade loss',async t=>{
  const f=await fixture(t),own=f.branch(),other=f.branch('other'),child=f.branch('other',own)
  await f.call('/data/knowledge_branches?id=eq.'+other,{method:'DELETE',role:'author'})
  assert.ok(f.db.prepare('SELECT id FROM knowledge_branches WHERE id=?').get(other))
  assert.equal((await f.call('/data/knowledge_branches?id=eq.'+own,{method:'PATCH',role:'author',body:{name:'No'}})).status,403)
  assert.equal((await f.call('/data/knowledge_branches',{method:'POST',role:'author',body:{name:'No',slug:'no'}})).status,403)
  assert.equal((await f.call('/data/knowledge_branches?id=eq.'+own,{method:'DELETE',role:'author'})).status,200)
  assert.equal(f.db.prepare('SELECT parent_id FROM knowledge_branches WHERE id=?').get(child).parent_id,null)
})

test('a branch name conflict aborts deletion without moving any notes or branches',async t=>{
  const f=await fixture(t),parent=f.branch('admin'),own=f.branch('author',parent),sibling=f.branch('other',parent,'same'),child=f.branch('other',own,'same'),note=f.article('author',own)
  const result=await f.call('/knowledge/nodes/b:'+own,{method:'DELETE',role:'author'})
  assert.equal(result.status,409);assert.ok(result.body.message.includes('同名'))
  assert.equal(f.db.prepare('SELECT parent_id FROM knowledge_branches WHERE id=?').get(child).parent_id,own)
  assert.equal(f.db.prepare('SELECT kb_branch_id FROM articles WHERE id=?').get(note).kb_branch_id,own)
  assert.ok(f.db.prepare('SELECT id FROM knowledge_branches WHERE id=?').get(sibling))
})

test('article node removal only detaches knowledge membership and removes its saved pin',async t=>{
  const f=await fixture(t),note=f.article()
  const path='/knowledge/nodes/a:'+note
  assert.equal((await f.call(path,{method:'DELETE',role:'other'})).status,403)
  await f.call(path+'/position',{method:'PUT',role:'admin',body:{x:12,y:22}})
  assert.equal((await f.call(path,{method:'DELETE',role:'author'})).status,200)
  const article=f.db.prepare('SELECT * FROM articles WHERE id=?').get(note)
  assert.equal(article.kb_enabled,0);assert.equal(article.status,'published');assert.equal(article.content,'Original Markdown')
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_positions').get().n,0)
  const other=f.article('other')
  assert.equal((await f.call('/knowledge/nodes/a:'+other,{method:'DELETE',role:'admin'})).status,200)
})

test('only administrators can persist or unpin positions, with input and visibility checks',async t=>{
  const f=await fixture(t),branch=f.branch(),privateNote=f.article('admin',null,'internal'),draft=f.article('admin',null,'public','draft')
  const path='/knowledge/nodes/b:'+branch+'/position'
  assert.equal((await f.call(path,{method:'PUT',body:{x:1,y:2}})).status,401)
  for(const role of ['author','other']) {
    assert.equal((await f.call(path,{method:'PUT',role,body:{x:1,y:2}})).status,403)
    assert.equal((await f.call(path,{method:'DELETE',role})).status,403)
  }
  assert.equal((await f.call(path,{method:'PUT',role:'admin',body:{x:0,y:-100}})).status,200)
  assert.equal((await f.call(path,{method:'PUT',role:'admin',body:{x:1,y:2},headers:{'X-RD-CSRF':''}})).status,403)
  assert.equal((await f.call(path,{method:'PUT',role:'admin',body:{x:1e7,y:2}})).status,400)
  assert.equal((await f.call(path,{method:'PUT',role:'admin',body:{x:1,y:2,pinned_by:f.ids.author}})).status,400)
  await f.call('/knowledge/nodes/a:'+privateNote+'/position',{method:'PUT',role:'admin',body:{x:2,y:3}})
  assert.equal((await f.call('/knowledge/nodes/a:'+draft+'/position',{method:'PUT',role:'admin',body:{x:2,y:3}})).status,404)
  assert.equal((await f.call('/knowledge/positions')).body.items.length,1)
  assert.equal((await f.call('/knowledge/positions',{role:'admin'})).body.items.length,2)
  await f.call('/knowledge/nodes/b:'+branch,{method:'DELETE',role:'author'})
  assert.equal((await f.call('/knowledge/positions')).body.items.length,0)
  assert.equal((await f.call('/knowledge/nodes/a:'+privateNote+'/position',{method:'DELETE',role:'admin'})).status,200)
})

test('approved requested branches belong to requester without counting creation and approval twice',async t=>{
  const f=await fixture(t),repository=new Repository(f.db)
  const row=repository.insert('knowledge_branches',{name:'Requested',slug:'requested',created_by:f.ids.author},{id:f.ids.admin,role:'admin'})
  assert.equal(row.created_by,f.ids.author)
  assert.equal(f.db.prepare("SELECT count(*) n FROM task_activity WHERE user_id=? AND kind='branch'").get(f.ids.author).n,0)
  const note=f.article('author',row.id),request=randomUUID()
  f.db.prepare("INSERT INTO knowledge_branch_requests(id,article_id,requester_id,requested_path,status) VALUES(?,?,?,'Requested','pending')").run(request,note,f.ids.author)
  f.db.prepare("UPDATE knowledge_branch_requests SET status='approved' WHERE id=?").run(request)
  assert.equal(f.db.prepare('SELECT count(*) n FROM task_activity WHERE user_id=?').get(f.ids.author).n,2)
  assert.equal((await f.call('/knowledge/nodes/b:'+row.id,{method:'DELETE',role:'author'})).status,200)
})
