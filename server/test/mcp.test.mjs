import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHmac } from 'node:crypto'
import { request } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { Repository } from '../repository.mjs'

async function fixture(t) {
  const dataDir=mkdtempSync(join(tmpdir(),'rd-mcp-'))
  const db=openDatabase(':memory:')
  const secret='mcp-test-secret-long-enough-for-session'
  db.prepare("INSERT INTO users(id,github_id,github_username) VALUES('admin','admin','admin')").run()
  db.prepare("INSERT INTO profiles(id,username,role) VALUES('admin','admin','admin')").run()
  const sid='mcp-admin-session'
  db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:'admin'},cookie:{httpOnly:true,path:'/',expires:new Date(Date.now()+86400000)}}),Date.now()+86400000)
  const signature=createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,'')
  const cookie='rd.sid='+encodeURIComponent('s:'+sid+'.'+signature)
  const repository=new Repository(db)
  const ids={}
  for(const [name,visibility,status] of [['public','public','published'],['internal','internal','published'],['draft','public','draft'],['pending','public','pending']]) {
    const row=repository.insert('articles',{title:'MCP '+name,content:'# '+name+'\n'+('note '.repeat(100)),visibility},{id:'admin',role:'admin'})
    db.prepare('UPDATE articles SET status=?,kb_enabled=? WHERE id=?').run(status,name==='public'?1:0,row.id)
    ids[name]=row.id
  }
  const app=createApp(db,{dataDir,production:false,sessionSecret:secret,siteUrl:'https://rd-studio.club',maxUploadMb:1,adminGithubIds:[]})
  const server=app.listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  const base='http://127.0.0.1:'+server.address().port
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dataDir,{recursive:true,force:true})})
  return {base,ids,cookie}
}

test('HTTP MCP uses SDK negotiation, reads public notes, and hides private content even with admin cookie',async t=>{
  const f=await fixture(t)
  const client=new Client({name:'rd-test',version:'1.0.0'})
  await client.connect(new StreamableHTTPClientTransport(new URL(f.base+'/api/mcp'),{requestInit:{headers:{Cookie:f.cookie}}}))
  t.after(()=>client.close())
  const tools=await client.listTools()
  assert.equal(tools.tools.length,5)
  assert.ok(tools.tools.every(tool=>tool.annotations.readOnlyHint))
  const search=await client.callTool({name:'search_articles',arguments:{query:'MCP'}})
  assert.deepEqual(search.structuredContent.items.map(a=>a.id),[f.ids.public])
  const kb=await client.callTool({name:'list_knowledge_articles',arguments:{}})
  assert.equal(kb.structuredContent.items[0].id,f.ids.public)
  const article=await client.callTool({name:'get_article',arguments:{id:f.ids.public,limit:10}})
  assert.equal(article.structuredContent.content.length,10)
  assert.equal(article.structuredContent.has_more,true)
  const continued=await client.callTool({name:'get_article',arguments:{id:f.ids.public,offset:10}})
  assert.equal(continued.structuredContent.has_more,false)
  for(const name of ['internal','draft','pending'])assert.equal((await client.callTool({name:'get_article',arguments:{id:f.ids[name]}})).isError,true)
  assert.equal((await client.callTool({name:'search_articles',arguments:{limit:999}})).isError,true)
  assert.equal((await client.callTool({name:'delete_article',arguments:{id:f.ids.public}})).isError,true)
  assert.ok((await client.readResource({uri:'rd-studio://guide'})).contents[0].text.includes('Read-only'))
})

test('HTTP MCP rejects cross-origin and invalid host and keeps normal API CSRF protection',async t=>{
  const f=await fixture(t)
  assert.equal((await fetch(f.base+'/api/mcp')).status,405)
  assert.equal((await fetch(f.base+'/api/mcp',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403)
  const badHost=await new Promise((resolve,reject)=>{const req=request(f.base+'/api/mcp',{method:'POST',headers:{Host:'evil.example','Content-Type':'application/json',Accept:'application/json, text/event-stream'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end('{}')})
  assert.equal(badHost,403)
  assert.equal((await fetch(f.base+'/api/data/articles',{method:'POST',headers:{Cookie:f.cookie,'Content-Type':'application/json'},body:'{}'})).status,403)
})

test('portable stdio MCP connects through the public API without credentials',async t=>{
  const f=await fixture(t)
  const client=new Client({name:'rd-stdio-test',version:'1.0.0'})
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve(import.meta.dirname,'../../mcp/rd-studio-mcp/server.mjs')],env:{...process.env,RD_STUDIO_URL:f.base},stderr:'pipe'})
  await client.connect(transport)
  t.after(()=>client.close())
  assert.equal((await client.listTools()).tools.length,5)
  assert.equal((await client.callTool({name:'search_articles',arguments:{}})).structuredContent.items.length,1)
  assert.equal((await client.callTool({name:'get_article',arguments:{id:f.ids.internal}})).isError,true)
  assert.equal((await client.callTool({name:'list_knowledge_branches',arguments:{}})).isError,undefined)
})
