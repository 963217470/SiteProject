import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID, createHmac } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { uploadVideoNote } from '../../mcp/rd-studio-mcp/upload-note.mjs'

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRu8AAAAASUVORK5CYII='
async function fixture(t) {
  const dataDir=mkdtempSync(join(tmpdir(),'rd-note-upload-'))
  const db=openDatabase(':memory:')
  const secret='note-test-secret-at-least-32-characters'
  const cookies={},ids={}
  for(const name of ['author','other','admin']) {
    const id=randomUUID(),sid=randomUUID();ids[name]=id
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(id,name,name)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(id,name,name==='admin'?'admin':'user')
    db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:id},cookie:{httpOnly:true,path:'/',expires:new Date(Date.now()+86400000)}}),Date.now()+86400000)
    const signature=createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,'')
    cookies[name]='rd.sid='+encodeURIComponent('s:'+sid+'.'+signature)
  }
  let time=Date.now()
  const config={dataDir,production:false,sessionSecret:secret,siteUrl:'https://rd-studio.club',maxUploadMb:5,adminGithubIds:[],now:()=>time}
  const server=createApp(db,config).listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  const base='http://127.0.0.1:'+server.address().port
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dataDir,{recursive:true,force:true})})
  async function call(path,{method='GET',user,token,body,headers={}}={}) {
    const response=await fetch(base+path,{method,headers:{'X-RD-CSRF':'1',...(user?{Cookie:cookies[user]}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined})
    return {status:response.status,body:await response.json().catch(()=>null)}
  }
  const mint=async(name='author',knowledge=false)=>(await call('/api/mcp-tokens',{method:'POST',user:name,body:{name:'test',allow_knowledge_write:knowledge}})).body
  return {db,base,call,mint,ids,cookies,dataDir,advance:ms=>time+=ms}
}

test('upload tokens require browser login and CSRF, store only hashes, expire and revoke by owner',async t=>{
  const f=await fixture(t)
  assert.equal((await f.call('/api/mcp-tokens',{method:'POST',body:{name:'x'}})).status,401)
  assert.equal((await f.call('/api/mcp-tokens',{method:'POST',user:'author',body:{name:'x'},headers:{'X-RD-CSRF':''}})).status,403)
  const minted=await f.mint()
  assert.match(minted.token,/^rd_/)
  assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM mcp_tokens').all()).includes(minted.token))
  assert.ok(!JSON.stringify((await f.call('/api/mcp-tokens',{user:'author'})).body).includes(minted.token))
  const identity=()=>f.call('/api/note-upload/get_upload_identity',{method:'POST',token:minted.token,body:{}})
  assert.equal((await identity()).body.username,'author')
  assert.equal((await f.call('/api/mcp-tokens/'+minted.id,{method:'DELETE',user:'other'})).status,404)
  assert.equal((await f.call('/api/mcp-tokens/'+minted.id,{method:'DELETE',user:'author'})).status,200)
  assert.equal((await identity()).status,401)
  const next=await f.mint();f.advance(91*86400000)
  assert.equal((await f.call('/api/note-upload/get_upload_identity',{method:'POST',token:next.token,body:{}})).status,401)
})

test('authenticated HTTP MCP saves owner drafts, deduplicates retries, checks revisions and cannot publish',async t=>{
  const f=await fixture(t),token=await f.mint(),admin=await f.mint('admin')
  const client=new Client({name:'upload-test',version:'1'})
  await client.connect(new StreamableHTTPClientTransport(new URL(f.base+'/api/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token.token}}}))
  t.after(()=>client.close())
  assert.equal((await client.listTools()).tools.length,9)
  const payload={import_key:'unique-note',title:'V2md',markdown:'# Note\n$E=mc^2$\n```js\nlet n=1\n```',tags:['视频转文']}
  const created=(await client.callTool({name:'save_article_draft',arguments:payload})).structuredContent
  assert.equal(created.status,'draft')
  assert.equal(f.db.prepare('SELECT author_id FROM articles WHERE id=?').get(created.id).author_id,f.ids.author)
  assert.equal((await client.callTool({name:'save_article_draft',arguments:payload})).structuredContent.id,created.id)
  assert.equal((await client.callTool({name:'save_article_draft',arguments:{...payload,markdown:'changed'}})).isError,true)
  assert.equal((await f.call('/api/note-upload/save_article_draft',{method:'POST',token:token.token,body:{...payload,status:'published'}})).status,400)
  const updated=(await client.callTool({name:'save_article_draft',arguments:{id:created.id,expected_revision:created.revision,title:'New',markdown:'changed'}})).structuredContent
  assert.equal(updated.status,'draft');assert.notEqual(updated.revision,created.revision)
  assert.equal((await client.callTool({name:'save_article_draft',arguments:{id:created.id,expected_revision:created.revision,title:'old',markdown:'stale'}})).isError,true)
  assert.equal((await f.call('/api/note-upload/get_own_draft',{method:'POST',token:admin.token,body:{id:created.id}})).status,404)
  assert.equal((await f.call('/api/data/articles',{method:'POST',token:token.token,body:{title:'forbidden',content:'x'}})).status,401)
  assert.equal((await client.callTool({name:'search_articles',arguments:{}})).structuredContent.items.length,0)
  f.db.prepare("UPDATE articles SET status='pending' WHERE id=?").run(created.id)
  assert.equal((await client.callTool({name:'get_own_draft',arguments:{id:created.id}})).isError,true)
})

test('note images validate bytes, deduplicate, stay private until publication and hide after withdrawal',async t=>{
  const f=await fixture(t),token=await f.mint()
  const upload=base64=>f.call('/api/note-upload/upload_note_image',{method:'POST',token:token.token,body:{base64}})
  assert.equal((await upload(Buffer.from('<svg></svg>').toString('base64'))).status,400)
  const image=(await upload(png)).body
  assert.equal((await upload(png)).body.id,image.id)
  assert.equal(f.db.prepare("SELECT count(*) n FROM files WHERE bucket='notes'").get().n,1)
  const path=new URL(image.url).pathname
  assert.equal((await fetch(f.base+path)).status,404)
  assert.equal((await fetch(f.base+path,{headers:{Cookie:f.cookies.author}})).status,200)
  assert.equal((await fetch(f.base+path,{headers:{Cookie:f.cookies.other}})).status,404)
  const draft=(await f.call('/api/note-upload/save_article_draft',{method:'POST',token:token.token,body:{import_key:'image-note',title:'Images',markdown:'![shot]('+image.url+')'}})).body
  f.db.prepare("UPDATE articles SET status='published' WHERE id=?").run(draft.id)
  assert.equal((await fetch(f.base+path)).status,200)
  f.db.prepare("UPDATE articles SET status='rejected' WHERE id=?").run(draft.id)
  assert.equal((await fetch(f.base+path)).status,404)
  assert.equal((await f.call('/api/note-upload/upload_note_image',{method:'POST',user:'author',body:{base64:png}})).status,401)
  assert.equal((await f.call('/api/note-upload/upload_note_image',{method:'POST',token:token.token,body:{base64:png},headers:{Origin:'https://evil.example'}})).status,403)
})

test('stdio imports real local note and assets without rewriting code, then updates the same draft',async t=>{
  const f=await fixture(t),token=await f.mint()
  const root=join(f.dataDir,'notes');mkdirSync(join(root,'_assets'),{recursive:true})
  writeFileSync(join(root,'_assets','截图.png'),Buffer.from(png,'base64'))
  const original='# 原始笔记\n\n![截图](_assets/截图.png)\n\n![引用][shot]\n\n[shot]: _assets/截图.png\n\n````md\n![示例](_assets/不存在.png)\n```\n````\n\n$E=mc^2$'
  const note=join(root,'note.md');writeFileSync(note,original)
  const client=new Client({name:'local-upload',version:'1'})
  await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve(import.meta.dirname,'../../mcp/rd-studio-mcp/server.mjs')],env:{...process.env,RD_STUDIO_URL:f.base,RD_STUDIO_UPLOAD_TOKEN:token.token,RD_STUDIO_NOTES_ROOT:root},stderr:'pipe'}))
  t.after(()=>client.close())
  assert.equal((await client.listTools()).tools.length,10)
  const saved=(await client.callTool({name:'upload_video_note',arguments:{note_path:'note.md',tags:['教程']}})).structuredContent
  assert.equal(saved.uploaded_images,1);assert.equal(saved.rewritten_image_references,2)
  const row=f.db.prepare('SELECT * FROM articles WHERE id=?').get(saved.id)
  assert.equal(row.status,'draft');assert.equal(row.title,'原始笔记')
  assert.ok(row.content.includes('````md\n![示例](_assets/不存在.png)\n```\n````'))
  assert.ok(row.content.includes('$E=mc^2$'))
  assert.deepEqual(JSON.parse(row.tags),['教程','视频转文'])
  assert.equal((await client.callTool({name:'upload_video_note',arguments:{note_path:'note.md',tags:['教程']}})).structuredContent.id,saved.id)
  writeFileSync(note,original+'\nNew paragraph')
  const current=(await client.callTool({name:'get_own_draft',arguments:{id:saved.id}})).structuredContent
  const update=await client.callTool({name:'upload_video_note',arguments:{note_path:'note.md',id:saved.id,expected_revision:current.revision}})
  assert.equal(update.structuredContent.id,saved.id)
})

test('local importer rejects traversal and missing images before network writes',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'rd-path-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const root=join(dir,'notes');mkdirSync(root)
  writeFileSync(join(dir,'outside.png'),Buffer.from(png,'base64'))
  writeFileSync(join(root,'bad.md'),'# Bad\n![outside](../outside.png)')
  let calls=0
  await assert.rejects(uploadVideoNote({note_path:'bad.md'},{root,request:async()=>{calls++}}),/超出/)
  assert.equal(calls,0)
  writeFileSync(join(root,'missing.md'),'# Missing\n![missing](_assets/missing.png)')
  await assert.rejects(uploadVideoNote({note_path:'missing.md'},{root,request:async()=>{calls++}}))
  assert.equal(calls,0)
})

test('HTTP MCP creates admin nodes and linked Markdown drafts with creator metadata and retry safety',async t=>{
  const f=await fixture(t),token=await f.mint('admin',true)
  const client=new Client({name:'node-writer-test',version:'1'})
  await client.connect(new StreamableHTTPClientTransport(new URL(f.base+'/api/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token.token}}}))
  t.after(()=>client.close())
  assert.equal((await client.listTools()).tools.length,10)
  const input={request_key:'node-test',name:'Shader notes',description:'Explain shaders with Markdown notes.'}
  const created=(await client.callTool({name:'create_knowledge_node',arguments:input})).structuredContent
  assert.equal(created.status,'created');assert.equal(created.creator.id,f.ids.admin)
  assert.equal(created.creator.username,'admin')
  assert.equal((await client.callTool({name:'create_knowledge_node',arguments:input})).structuredContent.id,created.id)
  assert.equal((await client.callTool({name:'create_knowledge_node',arguments:{...input,description:'Changed'}})).isError,true)
  const content='# Shader\n\n$E=mc^2$\n\n```glsl\nvec4 color = vec4(1.0);\n```'
  const draft=(await client.callTool({name:'save_article_draft',arguments:{import_key:'shader-note',title:'Shader',markdown:content,knowledge_branch_id:created.id}})).structuredContent
  const row=f.db.prepare('SELECT * FROM articles WHERE id=?').get(draft.id)
  assert.equal(row.status,'draft');assert.equal(row.content,content);assert.equal(row.kb_branch_id,created.id);assert.equal(row.kb_enabled,1)
  const listed=(await client.callTool({name:'list_knowledge_branches',arguments:{}})).structuredContent.items
  assert.equal(listed.find(b=>b.id===created.id).creator.username,'admin')
  const credits=(await f.call('/api/knowledge/creators')).body.items
  assert.equal(credits.find(c=>c.node_id===created.node_id).creator.username,'admin')
  assert.ok(!credits.some(c=>c.node_id==='a:'+draft.id))
})

test('knowledge writes require opted-in token; normal users only submit their own article-linked request',async t=>{
  const f=await fixture(t),old=await f.mint('admin'),token=await f.mint('author',true)
  const body={request_key:'normal-node',name:'Study node',description:'Requested explanation'}
  assert.equal((await f.call('/api/note-upload/create_knowledge_node',{method:'POST',token:old.token,body})).status,403)
  assert.equal((await f.call('/api/note-upload/create_knowledge_node',{method:'POST',token:token.token,body})).status,403)
  const draft=(await f.call('/api/note-upload/save_article_draft',{method:'POST',token:token.token,body:{import_key:'request-note',title:'Study',markdown:'# Study'}})).body
  const client=new Client({name:'request-node-test',version:'1'})
  await client.connect(new StreamableHTTPClientTransport(new URL(f.base+'/api/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token.token}}}))
  t.after(()=>client.close())
  const result=(await client.callTool({name:'create_knowledge_node',arguments:{...body,article_id:draft.id}})).structuredContent
  assert.equal(result.status,'pending');assert.equal(result.creator.id,f.ids.author)
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_branches').get().n,0)
  assert.equal(f.db.prepare('SELECT requested_description FROM knowledge_branch_requests WHERE id=?').get(result.request_id).requested_description,'Requested explanation')
  assert.equal((await client.callTool({name:'create_knowledge_node',arguments:{...body,article_id:draft.id}})).structuredContent.request_id,result.request_id)
  assert.equal((await client.callTool({name:'create_knowledge_node',arguments:{...body,article_id:draft.id,created_by:f.ids.admin}})).isError,true)
  const other=await f.mint('other',true)
  assert.equal((await f.call('/api/note-upload/create_knowledge_node',{method:'POST',token:other.token,body:{...body,article_id:draft.id}})).status,403)
})

test('stdio exposes opted-in node writing and preserves the creator of reused existing branches',async t=>{
  const f=await fixture(t),token=await f.mint('admin',true)
  const client=new Client({name:'stdio-node-test',version:'1'})
  await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve(import.meta.dirname,'../../mcp/rd-studio-mcp/server.mjs')],env:{...process.env,RD_STUDIO_URL:f.base,RD_STUDIO_UPLOAD_TOKEN:token.token,RD_STUDIO_KNOWLEDGE_WRITE:'1'},stderr:'pipe'}))
  t.after(()=>client.close())
  assert.equal((await client.listTools()).tools.length,11)
  const id=randomUUID()
  f.db.prepare("INSERT INTO knowledge_branches(id,name,slug,description,created_by) VALUES(?,'Existing','existing','Original',?)").run(id,f.ids.author)
  const result=(await client.callTool({name:'create_knowledge_node',arguments:{request_key:'reuse',name:'Existing',description:'New'}})).structuredContent
  assert.equal(result.id,id);assert.equal(result.reused,true);assert.equal(result.creator.id,f.ids.author);assert.equal(result.description,'Original')
  assert.equal((await client.callTool({name:'create_knowledge_node',arguments:{request_key:'bad-parent',name:'Node',parent_id:'does-not-exist'}})).isError,true)
})
