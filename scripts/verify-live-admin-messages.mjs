// Run through stdin from the deployed server directory; never print session credentials.
import assert from 'node:assert/strict'
import {randomUUID,createHmac} from 'node:crypto'
import {openDatabase} from './database.mjs'
process.loadEnvFile('/etc/rd-studio.env')
const db=openDatabase('/var/lib/rd-studio/site.sqlite'),sid=randomUUID(),now=Date.now()
const users=db.prepare("SELECT id FROM profiles WHERE lower(username)='wind-celeste' AND role='admin'").all()
assert.equal(users.length,1)
assert.equal(db.prepare('PRAGMA user_version').get().user_version,9)
db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:users[0].id},cookie:{originalMaxAge:60000,expires:new Date(now+60000),httpOnly:true,path:'/'}}),now+60000)
const signed='s:'+sid+'.'+createHmac('sha256',process.env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/,'')
try{
  const get=async(path)=>{
    const r=await fetch('http://127.0.0.1:3100/api'+path,{headers:{Cookie:'rd.sid='+encodeURIComponent(signed)}})
    assert.ok(r.ok,'Read-only verification failed: '+path);return r.json()
  }
  const overview=await get('/admin/overview'),queue=await get('/admin/queue'),messages=await get('/messages'),activity=await get('/admin/activity')
  assert.equal(overview.queues.length,6);assert.ok(Array.isArray(queue.items));assert.ok(Array.isArray(activity.items));assert.ok(Number.isInteger(messages.sync_cursor))
  const denied=await fetch('http://127.0.0.1:3100/api/admin/overview');assert.equal(denied.status,401)
  console.log(JSON.stringify({schema:9,review_types:overview.queues.length,pending:overview.pending,queue_rows:queue.items.length,unread:messages.unread,anonymous_admin_access:'denied',verification:'read only; no broadcast sent'}))
}finally{db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);db.close()}
