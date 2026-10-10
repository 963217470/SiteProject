import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'

async function fixture(t) {
  const db=openDatabase(':memory:'), dataDir=mkdtempSync(join(tmpdir(),'rd-catalog-')),secret='catalog-test-secret-at-least-thirty-two-characters', cookies={}
  let time=Date.now()
  for(const role of ['admin','user','other']) {
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(role,role,role)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(role,role,role==='admin'?'admin':'user')
    const sid=randomUUID()
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:role},cookie:{expires:new Date(time+86400000),httpOnly:true,path:'/'}}),time+86400000)
    cookies[role]='rd.sid='+encodeURIComponent('s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''))
  }
  const server=createApp(db,{now:()=>time,dataDir,production:false,sessionSecret:secret,siteUrl:'http://localhost',maxUploadMb:1,adminGithubIds:[]}).listen(0,'127.0.0.1')
  await new Promise(r=>server.once('listening',r))
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();rmSync(dataDir,{recursive:true,force:true})})
  async function call(path,role=null,method='GET',body,extra={}) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'X-RD-CSRF':'1',...(role?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined})
    const text=await response.text();return {status:response.status,data:response.headers.get('content-type')?.includes('json')?JSON.parse(text):text}
  }
  const body={kind:'game',title:'Game',summary:'Test',content:'# Game\n\nDescription',external_url:'https://pan.baidu.com/s/test',assets:[],status:'published'}
  const create=async(role='user',extra={})=>{const result=await call('/catalog',role,'POST',{...body,...extra});assert.equal(result.status,201);return result.data.id}
  function file(owner='user',mime='application/octet-stream') {const id=randomUUID(),path=owner+'/'+id+'/package.zip';db.prepare("INSERT INTO files VALUES(?,'catalog',?,?,?,4)").run(id,path,owner,mime);writeFileSync(join(dataDir,'uploads',id),'test');return {id,path,url:'/api/files/catalog/'+path}}
  async function upload(body,type='application/json') {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/storage/catalog/user/${randomUUID()}/package.json`,{method:'POST',headers:{'X-RD-CSRF':'1',Cookie:cookies.user,'Content-Type':type},body})
    return {status:response.status,data:await response.json()}
  }
  return {db,call,create,file,body,upload,advance:ms=>time+=ms}
}
test('catalog is public only after review and cannot be written through generic data API',async t=>{
  const f=await fixture(t),id=await f.create()
  assert.equal((await f.call('/catalog')).data.items.length,0)
  assert.equal((await f.call('/catalog/'+id)).status,404)
  assert.equal((await f.call('/catalog?scope=mine','user')).data.items.length,1)
  assert.equal((await f.call('/catalog?scope=review','user')).status,403)
  assert.equal((await f.call('/catalog','user','POST',{...f.body,status:'archived'})).status,400)
  assert.equal((await f.call('/data/catalog_items','admin')).status,404)
  assert.equal((await f.call('/catalog',null,'POST',f.body)).status,401)
  assert.equal((await f.call('/catalog/'+id+'/review','admin','POST',{status:'published',revision:1})).status,200)
  assert.equal((await f.call('/catalog')).data.items.length,1)
})
test('ownership, optimistic concurrency and edit re-review are enforced',async t=>{
  const f=await fixture(t),id=await f.create()
  assert.equal((await f.call('/catalog/'+id,'other','PUT',{...f.body,revision:1})).status,404)
  await f.call('/catalog/'+id+'/review','admin','POST',{status:'published',revision:1})
  assert.equal((await f.call('/catalog/'+id,'user','PUT',{...f.body,revision:1})).status,409)
  assert.equal((await f.call('/catalog/'+id,'user','PUT',{...f.body,revision:2})).data.status,'pending')
  assert.equal((await f.call('/catalog/'+id)).status,404)
  assert.equal((await f.call('/catalog/'+id,'user','PUT',f.body)).status,400)
})
test('unsafe links, arbitrary fields and invalid assets cannot publish',async t=>{
  const f=await fixture(t),foreign=f.file('other'),own=f.file()
  for(const url of ['javascript:alert(1)','http://example.com','https://user:password@example.com'])assert.equal((await f.call('/catalog','user','POST',{...f.body,external_url:url})).status,400)
  assert.equal((await f.call('/catalog','user','POST',{...f.body,assets:[foreign.id]})).status,403)
  assert.equal((await f.call('/catalog','user','POST',{...f.body,assets:[own.id],cover_id:own.id})).status,400)
  assert.equal((await f.call('/catalog','user','POST',{...f.body,external_url:'',assets:[]})).status,400)
  const id=await f.create('user',{author_id:'admin',downloads:999,status:'draft'})
  const row=(await f.call('/catalog/'+id,'user')).data;assert.equal(row.author_id,'user');assert.equal(row.downloads,0)
})
test('private attachments become public with their item and archived files are private again',async t=>{
  const f=await fixture(t),file=f.file(),id=await f.create('user',{assets:[file.id]})
  assert.equal((await f.call(file.url.replace('/api',''))).status,401)
  assert.equal((await f.call(file.url.replace('/api',''),'user')).status,200)
  assert.equal((await f.call('/storage/catalog','user','DELETE',{prefixes:[file.path]})).status,409)
  await f.call('/catalog/'+id+'/review','admin','POST',{status:'published',revision:1})
  assert.equal((await f.call(file.url.replace('/api',''))).status,200)
  assert.equal((await f.call('/catalog/'+id+'/review','admin','POST',{status:'archived',revision:2,note:'Unavailable'})).status,200)
  assert.equal((await f.call(file.url.replace('/api',''))).status,401)
})
test('download targets are constrained and repeated visits are deduplicated',async t=>{
  const f=await fixture(t),file=f.file('admin'),id=await f.create('admin',{assets:[file.id]})
  assert.equal((await f.call('/catalog/'+id+'/download',null,'POST',{target:'https://evil.test'})).status,404)
  const external=await f.call('/catalog/'+id+'/download',null,'POST',{target:'external'});assert.equal(external.data.url,f.body.external_url);assert.equal(external.data.downloads,1)
  assert.equal((await f.call('/catalog/'+id+'/download',null,'POST',{target:'external'})).data.downloads,1)
  assert.equal((await f.call('/catalog/'+id+'/download',null,'POST',{target:file.id})).data.downloads,2)
  f.advance(600001)
  assert.equal((await f.call('/catalog/'+id+'/download',null,'POST',{target:'external'})).data.downloads,3)
  assert.equal((await f.call('/catalog/'+id+'/download',null,'POST',{target:'external'},{'X-RD-CSRF':'0'})).status,403)
})
test('filters, pagination, and search escaping remain scoped',async t=>{
  const f=await fixture(t)
  for(let n=0;n<26;n++)await f.create('admin',{kind:'tool',title:'Tool '+n})
  await f.create('user',{title:'Hidden'})
  assert.equal((await f.call('/catalog?kind=tool')).data.items.length,24)
  assert.equal((await f.call('/catalog?kind=tool')).data.has_more,true)
  assert.equal((await f.call('/catalog?offset=24')).data.items.length,2)
  assert.equal((await f.call('/catalog?q=%25')).data.items.length,0)
  assert.equal((await f.call('/catalog?scope=mine')).status,401)
  assert.equal((await f.call('/catalog?offset=-1')).status,400)
})
test('reject and resubmit retain ownership and require moderation reasons',async t=>{
  const f=await fixture(t),id=await f.create()
  assert.equal((await f.call('/catalog/'+id+'/review','admin','POST',{status:'rejected',revision:1})).status,400)
  await f.call('/catalog/'+id+'/review','admin','POST',{status:'rejected',revision:1,note:'Missing documentation'})
  assert.equal((await f.call('/catalog/'+id,'user')).data.review_note,'Missing documentation')
  assert.equal((await f.call('/catalog/'+id,'user','PUT',{...f.body,revision:2})).status,200)
  assert.equal((await f.call('/catalog/'+id,'user')).data.review_note,'')
})
test('JSON attachments are streamed intact rather than consumed by API parser',async t=>{
  const f=await fixture(t),source='{"name":"shared-tool","version":"1.0.0"}',result=await f.upload(source)
  assert.equal(result.status,201);assert.equal(result.data.size,Buffer.byteLength(source));assert.equal(result.data.mime,'application/octet-stream')
  assert.equal((await f.call('/files/catalog/'+result.data.path,'user')).data,source)
  assert.equal((await f.upload('')).status,400)
  assert.equal((await f.upload(Buffer.alloc(1024*1024+1),'application/octet-stream')).status,413)
})
