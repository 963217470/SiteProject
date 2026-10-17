import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { Repository } from '../repository.mjs'
import { createKnowledgeWriter } from '../mcp-knowledge.mjs'

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

test('directory placement and connections are independent, atomic and administrator-only',async t=>{
  const f=await fixture(t),cognition=f.branch('admin'),art=f.branch('admin',cognition)
  const body={name:'Planning',parent_id:cognition,connect_to:'b:'+art}
  assert.equal((await f.call('/knowledge/branches',{method:'POST',body})).status,401)
  assert.equal((await f.call('/knowledge/branches',{method:'POST',role:'author',body})).status,403)
  const created=await f.call('/knowledge/branches',{method:'POST',role:'admin',body})
  assert.equal(created.status,201)
  const key=created.body.node_id
  assert.equal(f.db.prepare('SELECT parent_id FROM knowledge_branches WHERE id=?').get(created.body.id).parent_id,cognition)
  let links=(await f.call('/knowledge/connections')).body.items.filter(e=>e.source===key||e.target===key)
  assert.deepEqual(links.map(e=>[e.source,e.target]),[[key,'b:'+art].sort()])
  assert.equal((await f.call('/knowledge/nodes/'+key+'/hierarchy',{method:'PATCH',role:'admin',body:{parent_id:null}})).status,200)
  assert.deepEqual((await f.call('/knowledge/connections')).body.items.filter(e=>e.source===key||e.target===key),links)
  for(const method of ['PUT','DELETE'])assert.equal((await f.call('/knowledge/connections',{method,role:'author',body:{source:key,target:'root'}})).status,403)
  assert.equal((await f.call('/knowledge/connections',{method:'PUT',role:'admin',body:{source:key,target:key}})).status,400)
  const before=f.db.prepare('SELECT count(*) n FROM knowledge_branches').get().n
  assert.equal((await f.call('/knowledge/branches',{method:'POST',role:'admin',body:{name:'Bad',parent_id:cognition,connect_to:'b:missing'}})).status,404)
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_branches').get().n,before)
  assert.equal((await f.call('/knowledge/branches',{method:'POST',role:'admin',body})).status,201) // Original moved out; name can now be reused.
})

test('graph cycles are allowed, tree cycles rejected, edge removal does not delete or reparent nodes',async t=>{
  const f=await fixture(t),p=f.branch('admin'),child=f.branch('author',p)
  assert.equal((await f.call('/knowledge/nodes/b:'+p+'/hierarchy',{method:'PATCH',role:'admin',body:{parent_id:child}})).status,400)
  const edge={source:'root',target:'b:'+child}
  for(const body of [edge,{source:edge.target,target:edge.source}])assert.equal((await f.call('/knowledge/connections',{method:'PUT',role:'admin',body})).status,200)
  assert.equal((await f.call('/knowledge/connections')).body.items.length,3)
  assert.equal((await f.call('/knowledge/connections',{method:'DELETE',role:'admin',body:edge})).status,200)
  assert.equal(f.db.prepare('SELECT parent_id FROM knowledge_branches WHERE id=?').get(child).parent_id,p)
  await f.call('/knowledge/nodes/b:'+p,{method:'DELETE',role:'admin'})
  assert.equal((await f.call('/knowledge/connections')).body.items.length,0)
  assert.ok(f.db.prepare('SELECT id FROM knowledge_branches WHERE id=?').get(child))
})

test('connections never expose private or unpublished note IDs and detach cleans edges',async t=>{
  const f=await fixture(t),p=f.branch(),internal=f.article('admin',p,'internal'),draft=f.article('author',p,'public','draft')
  const publicLinks=(await f.call('/knowledge/connections')).body.items
  assert.equal(publicLinks.some(e=>[e.source,e.target].some(id=>id==='a:'+internal||id==='a:'+draft)),false)
  assert.equal((await f.call('/knowledge/connections',{role:'admin'})).body.items.length,2)
  assert.equal((await f.call('/knowledge/connections',{method:'PUT',role:'admin',body:{source:'root',target:'a:'+draft}})).status,404)
  await f.call('/knowledge/nodes/a:'+internal,{method:'DELETE',role:'admin'})
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_connections WHERE source=? OR target=?').get('a:'+internal,'a:'+internal).n,0)
})

test('MCP can create a peer connected elsewhere without changing the old parent-only contract',async t=>{
  const f=await fixture(t),p=f.branch('admin'),other=f.branch('admin'),write=createKnowledgeWriter(new Repository(f.db),{siteUrl:'https://rd-studio.club'})
  const user={id:f.ids.admin,role:'admin',allow_knowledge_write:true},input={request_key:'peer',name:'Peer',parent_id:null,connect_to:'b:'+p}
  const result=write(user,input),key=result.node_id
  assert.equal(result.parent_id,null)
  assert.deepEqual(f.db.prepare('SELECT source,target FROM knowledge_connections WHERE source=? OR target=?').all(key,key).map(e=>[e.source,e.target]),[[key,'b:'+p].sort()])
  assert.equal(write(user,input).reused,true)
  assert.throws(()=>write(user,{...input,connect_to:'root'}),e=>e.status===409)
  const legacy=write(user,{request_key:'legacy',name:'Legacy',parent_id:other})
  assert.ok(f.db.prepare('SELECT 1 FROM knowledge_connections WHERE source=? AND target=?').get(...[legacy.node_id,'b:'+other].sort()))
  const isolated=write(user,{request_key:'isolated',name:'Isolated',connect_to:null})
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_connections WHERE source=? OR target=?').get(isolated.node_id,isolated.node_id).n,0)
})
