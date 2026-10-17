import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { Repository } from '../repository.mjs'

const secret = 'test-secret-at-least-thirty-two-characters'

test('first image projection returns cover metadata without content or private article leakage and cannot be written',async t=>{
  const f=await fixture(t),id=f.article(),hidden=f.article('public','draft')
  f.db.prepare('UPDATE articles SET content=? WHERE id=?').run('```md\n![example](/wrong.png)\n```\n\n![first][shot]\n\n[shot]: /api/files/notes/author/first.png',id)
  f.db.prepare('UPDATE articles SET content=? WHERE id=?').run('![secret](/private-secret.png)',hidden)
  const result=await f.call('/data/articles?select=id,title,first_image_url')
  assert.equal(result.status,200)
  assert.equal(result.body.find(row=>row.id===id).first_image_url,'/api/files/notes/author/first.png')
  assert.equal(result.body.some(row=>row.id===hidden),false)
  assert.equal(result.body.some(row=>'content' in row),false)
  assert.equal((await f.call('/data/articles?id=eq.'+id,{role:'admin',method:'PATCH',body:{first_image_url:'/spoof.png'}})).status,400)
})

test('public member pages expose only public publications and safe profile fields',async t=>{
  const f=await fixture(t),publicId=f.article(),draft=f.article('public','draft'),internal=f.article('internal')
  f.db.prepare('UPDATE articles SET author_id=? WHERE id=?').run(f.ids.user,internal)
  f.db.prepare("UPDATE users SET email='private@example.com' WHERE id=?").run(f.ids.user)
  const result=await f.call('/members/'+f.ids.user)
  assert.equal(result.status,200)
  assert.deepEqual(result.body.articles.map(a=>a.id),[publicId])
  assert.equal(result.body.stats.articles,1)
  assert.ok(!JSON.stringify(result.body).includes(draft))
  assert.ok(!JSON.stringify(result.body).includes('private@example.com'))
  assert.ok(!('email' in result.body.profile))
  assert.equal((await f.call('/members/'+f.ids.user,{role:'admin'})).body.articles.length,1)
  assert.equal((await f.call('/members/missing')).status,404)
  assert.equal((await f.call('/members/'+f.ids.user+'?offset=-1')).status,400)
})

test('avatars validate actual raster bytes and ownership, then remain pending until approval',async t=>{
  const f=await fixture(t)
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhF8AAAAASUVORK5CYII=','base64')
  const upload=async(path,body)=>fetch(f.base+'/api/storage/avatars/'+path,{method:'POST',headers:{'X-RD-CSRF':'1',Cookie:f.cookies.user,'Content-Type':'image/png'},body})
  const path=f.ids.user+'/avatar.png'
  assert.equal((await upload(f.ids.user+'/fake.png',Buffer.from('<svg/>'))).status,400)
  assert.equal((await upload(f.ids.other+'/wrong.png',png)).status,403)
  assert.equal((await upload(f.ids.user+'/large.png',Buffer.alloc(2*1024*1024+1))).status,413)
  assert.equal((await upload(path,png)).status,201)
  const url='/api/files/avatars/'+path
  const submit=async(role,avatar)=>f.call('/data/profile_changes',{method:'POST',role,body:{username:role,avatar_url:avatar,bio:'',status:'pending'}})
  assert.equal((await submit('other',url)).status,400)
  assert.equal((await submit('user','https://example.com/avatar.png')).status,400)
  const request=await submit('user',url)
  assert.equal(request.status,200)
  assert.notEqual(f.db.prepare('SELECT avatar_url FROM profiles WHERE id=?').get(f.ids.user).avatar_url,url)
  await f.call('/data/profiles?id=eq.'+f.ids.user,{role:'admin',method:'PATCH',body:{avatar_url:url}})
  await f.call('/data/profile_changes?id=eq.'+request.body[0].id,{role:'admin',method:'PATCH',body:{status:'approved'}})
  assert.equal((await f.call('/members/'+f.ids.user)).body.profile.avatar_url,url)
  f.db.prepare("INSERT INTO knowledge_branches(id,name,slug,created_by) VALUES('credit','Credit','credit',?)").run(f.ids.user)
  assert.equal((await f.call('/knowledge/creators')).body.items.find(n=>n.node_id==='b:credit').creator.avatar_url,url)
})

test('admin own profile is approved atomically while other accounts and avatar ownership stay protected', async t => {
  const f=await fixture(t)
  const before=f.db.prepare('SELECT * FROM profiles WHERE id=?').get(f.ids.user)
  const saved=await f.call('/data/profile_changes',{method:'POST',role:'admin',body:{user_id:f.ids.user,username:'New admin',bio:'Immediate bio',status:'pending'}})
  assert.equal(saved.status,200)
  const row=saved.body[0]
  assert.equal(row.status,'approved');assert.equal(row.user_id,f.ids.admin);assert.equal(row.reviewed_by,f.ids.admin);assert.ok(row.reviewed_at)
  assert.equal(f.db.prepare('SELECT username FROM profiles WHERE id=?').get(f.ids.admin).username,'New admin')
  assert.equal(f.db.prepare('SELECT bio FROM profiles WHERE id=?').get(f.ids.admin).bio,'Immediate bio')
  assert.deepEqual(f.db.prepare('SELECT * FROM profiles WHERE id=?').get(f.ids.user),before)
  assert.equal(f.db.prepare("SELECT count(*) n FROM profile_changes WHERE user_id=? AND status='pending'").get(f.ids.admin).n,0)
  assert.ok(f.db.prepare("SELECT 1 FROM admin_activity WHERE entity_id=? AND action='资料自动通过'").get(row.id))
  assert.equal(f.db.prepare("SELECT count(*) n FROM notifications WHERE category='review'").get().n,0)
  assert.equal((await f.call('/admin/profile/'+row.id+'/review',{method:'POST',role:'admin',body:{approved:true}})).status,409)
  const beforeCount=f.db.prepare('SELECT count(*) n FROM profile_changes').get().n
  assert.equal((await f.call('/data/profile_changes',{method:'POST',role:'admin',body:{username:'   '}})).status,400)
  assert.equal(f.db.prepare('SELECT count(*) n FROM profile_changes').get().n,beforeCount)
  assert.equal(f.db.prepare('SELECT username FROM profiles WHERE id=?').get(f.ids.admin).username,'New admin')
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhF8AAAAASUVORK5CYII=','base64')
  const path=f.ids.admin+'/own-avatar.png'
  assert.equal((await fetch(f.base+'/api/storage/avatars/'+path,{method:'POST',headers:{'X-RD-CSRF':'1',Cookie:f.cookies.admin,'Content-Type':'image/png'},body:png})).status,201)
  const url='/api/files/avatars/'+path
  assert.equal((await f.call('/data/profile_changes',{method:'POST',role:'user',body:{avatar_url:url}})).status,400)
  const avatar=await f.call('/data/profile_changes',{method:'POST',role:'admin',body:{avatar_url:url,bio:''}})
  assert.equal(avatar.body[0].status,'approved')
  assert.equal(f.db.prepare('SELECT avatar_url FROM profiles WHERE id=?').get(f.ids.admin).avatar_url,url)
  assert.equal(f.db.prepare('SELECT bio FROM profiles WHERE id=?').get(f.ids.admin).bio,'')
  const member=await f.call('/data/profile_changes',{method:'POST',role:'user',body:{username:'Pending name',status:'approved'}})
  assert.equal(member.body[0].status,'pending')
  assert.equal(f.db.prepare('SELECT username FROM profiles WHERE id=?').get(f.ids.user).username,before.username)
  assert.equal((await f.call('/data/profile_changes',{method:'POST',role:'user',body:{username:'Escalation',role:'admin'}})).status,400)
})

test('reading time is bounded, deduplicated across tabs and inactive gaps earn nothing', async t => {
  let time = 200000
  const f = await fixture(t, () => time)
  const article = f.article()
  const start = async () => (await f.call('/reading/start', { role: 'member', method: 'POST', body: { article_id: article } })).body.id
  const one = await start(), two = await start()
  const tick = async (id, active = true) => f.call('/reading/' + id + '/tick', { role: 'member', method: 'POST', body: { active, seconds: 999999 } })
  await tick(one); await tick(two)
  time += 15000
  assert.equal((await tick(one)).body.credited_seconds, 15)
  assert.equal((await tick(two)).body.credited_seconds, 0)
  assert.equal((await tick(one)).body.credited_seconds, 0)
  await tick(one, false)
  time += 15000
  assert.equal((await tick(one)).body.credited_seconds, 0)
  time += 120000
  assert.equal((await tick(one)).body.credited_seconds, 0)
  assert.equal((await f.call('/reading/history', { role: 'member' })).body.items[0].reading_seconds, 15)
  assert.equal((await f.call('/reading/history', { role: 'other' })).body.items.length, 0)
})

test('reading history enforces identity and revoked article access', async t => {
  const f = await fixture(t)
  const article = f.article('internal')
  f.db.prepare('UPDATE articles SET author_id=? WHERE id=?').run(f.ids.admin, article)
  assert.equal((await f.call('/reading/start', { method: 'POST', body: { article_id: article } })).status, 401)
  assert.equal((await f.call('/reading/start', { role: 'other', method: 'POST', body: { article_id: article } })).status, 404)
  const created = await f.call('/reading/start', { role: 'member', method: 'POST', body: { article_id: article } })
  assert.equal((await f.call('/reading/' + created.body.id + '/tick', { role: 'other', method: 'POST', body: { active: true } })).status, 404)
  assert.equal((await f.call('/reading/history', { role: 'admin' })).body.items.length, 0)
  f.db.prepare('UPDATE experience_levels SET threshold=999999 WHERE threshold=300').run()
  assert.equal((await f.call('/reading/history', { role: 'member' })).body.items.length, 0)
  assert.equal((await f.call('/reading/' + created.body.id + '/tick', { role: 'member', method: 'POST', body: { active: true } })).status, 404)
})

test('history removal is scoped, invalid input cannot clear records, and clear closes sessions', async t => {
  const f = await fixture(t)
  const article = f.article()
  const start = role => f.call('/reading/start', { role, method: 'POST', body: { article_id: article } })
  const created = await start('member'); await start('other')
  assert.equal((await f.call('/reading/history', { role: 'member', method: 'DELETE', body: { article_id: '' } })).status, 400)
  assert.equal((await f.call('/reading/history', { role: 'member' })).body.items.length, 1)
  await f.call('/reading/history', { role: 'member', method: 'DELETE', body: {} })
  assert.equal((await f.call('/reading/history', { role: 'member' })).body.items.length, 0)
  assert.equal((await f.call('/reading/history', { role: 'other' })).body.items.length, 1)
  assert.equal((await f.call('/reading/' + created.body.id + '/tick', { role: 'member', method: 'POST', body: { active: true } })).status, 404)
  assert.equal((await f.call('/reading/history?offset=-1', { role: 'member' })).status, 400)
})

async function fixture(t, now) {
  const dataDir = mkdtempSync(join(tmpdir(), 'rd-api-'))
  const db = openDatabase(':memory:')
  const ids = {}
  const cookies = {}
  for (const role of ['user', 'member', 'admin', 'other']) {
    ids[role] = randomUUID()
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(ids[role], role, role)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(ids[role], role, role === 'other' ? 'user' : role)
    const sid = randomUUID()
    db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid, JSON.stringify({ passport: { user: ids[role] }, cookie: { originalMaxAge: 86400000, expires: new Date(Date.now() + 86400000), httpOnly: true, path: '/' } }), Date.now() + 86400000)
    const signed = sid + '.' + createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '')
    cookies[role] = 'rd.sid=' + encodeURIComponent('s:' + signed)
  }
  db.prepare("INSERT INTO community_experience(id,user_id,source_key,amount,reason,created_at) VALUES('fixture',?,'fixture',300,'测试正式社员',0)").run(ids.member)
  const app = createApp(db, { now, dataDir, production: false, sessionSecret: secret, siteUrl: 'http://localhost', maxUploadMb: 1, adminGithubIds: [], githubClientId: 'test-client', githubClientSecret: 'test-secret' })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dataDir, { recursive: true, force: true }) })
  async function call(path, { role, method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(base + '/api' + path, { method, headers: { 'X-RD-CSRF': '1', ...(role ? { Cookie: cookies[role] } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
    const text = await response.text()
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text, headers: response.headers }
  }
  const repository = new Repository(db)
  const user = role => ({ id: ids[role], role: role === 'other' ? 'user' : role })
  function article(visibility = 'public', status = 'published') {
    const row = repository.insert('articles', { title: 'Example', content: 'text', visibility }, user(visibility === 'internal' ? 'member' : 'user'))
    db.prepare('UPDATE articles SET status=? WHERE id=?').run(status, row.id)
    return row.id
  }
  return { call, db, ids, cookies, base, article }
}

test('article visibility enforces public, internal, draft and admin access', async t => {
  const f = await fixture(t)
  f.article(); f.article('internal'); f.article('public', 'draft')
  assert.equal((await f.call('/data/articles')).body.length, 1)
  assert.equal((await f.call('/data/articles', { role: 'member' })).body.length, 2)
  assert.equal((await f.call('/data/articles', { role: 'user' })).body.length, 2)
  assert.equal((await f.call('/data/articles', { role: 'admin' })).body.length, 3)
})

test('internal access uses server EXP boundary and protects articles, comments, resources and files', async t => {
  const f=await fixture(t)
  const id=f.article('internal');f.db.prepare('UPDATE articles SET author_id=? WHERE id=?').run(f.ids.admin,id)
  f.db.prepare("INSERT INTO internal_resources(id,title,status,file_url,created_by) VALUES('private-resource','内部资料','published','/api/files/resources/known.txt',?)").run(f.ids.admin)
  const grant=n=>f.db.prepare('INSERT INTO community_experience(id,user_id,source_key,amount,reason,created_at) VALUES(?,?,?,?,?,0)').run(randomUUID(),f.ids.other,randomUUID(),n,'测试经验')
  grant(299)
  assert.equal((await f.call('/internal/access?xp=999999',{role:'other'})).body.allowed,false)
  assert.equal((await f.call('/data/articles?id=eq.'+id,{role:'other'})).body.length,0)
  assert.equal((await f.call('/comments?article_id='+id,{role:'other'})).status,404)
  assert.equal((await f.call('/data/internal_resources',{role:'other'})).body.length,0)
  assert.equal((await f.call('/files/internal/known.txt',{role:'other'})).status,403)
  assert.equal((await f.call('/files/resources/known.txt',{role:'other'})).status,403)
  grant(1)
  assert.equal((await f.call('/internal/access',{role:'other'})).body.allowed,true)
  assert.equal((await f.call('/data/articles?id=eq.'+id,{role:'other'})).body.length,1)
  assert.equal((await f.call('/data/internal_resources',{role:'other'})).body.length,1)
  assert.equal((await f.call('/files/internal/known.txt',{role:'other'})).status,404)
  assert.equal((await f.call('/internal/access',{role:'admin'})).body.allowed,true)
  assert.equal((await f.call('/internal/access')).body.allowed,false)
  f.db.prepare('UPDATE articles SET author_id=? WHERE id=?').run(f.ids.user,id)
  assert.equal((await f.call('/data/articles?id=eq.'+id,{role:'user'})).body.length,0)
  assert.equal((await f.call('/data/articles',{role:'user',method:'POST',body:{title:'秘密',content:'内容',visibility:'internal'}})).status,403)
})

test('article writes bind author, require review and reject privilege escalation', async t => {
  const f = await fixture(t)
  const created = await f.call('/data/articles', { role: 'user', method: 'POST', body: { title: 'title', content: 'body', author_id: f.ids.admin, status: 'published' } })
  assert.equal(created.status, 200)
  assert.equal(created.body[0].author_id, f.ids.user)
  assert.equal(created.body[0].status, 'pending')
  const id = created.body[0].id
  assert.equal((await f.call('/data/articles?id=eq.' + id, { role: 'user', method: 'PATCH', body: { status: 'published' } })).status, 403)
  assert.equal((await f.call('/data/profiles?id=eq.' + f.ids.user, { role: 'user', method: 'PATCH', body: { role: 'admin' } })).status, 403)
  assert.equal((await f.call('/data/articles?id=eq.' + id, { role: 'other', method: 'DELETE' })).body.length, 0)
  assert.ok(f.db.prepare('SELECT id FROM articles WHERE id=?').get(id))
})

test('likes and comments update counts without trusting browser-supplied counts', async t => {
  const f = await fixture(t)
  const id = f.article()
  const write = { role: 'member', method: 'POST', body: { article_id: id, user_id: f.ids.admin } }
  await f.call('/data/article_likes', write)
  await f.call('/data/article_likes', write)
  assert.equal((await f.call('/data/comments', { ...write, body: { ...write.body, content: 'comment' } })).status,403)
  const comment=await f.call('/comments', { ...write, body: { ...write.body, content: 'comment' } })
  assert.equal(comment.status,201)
  assert.equal(f.db.prepare('SELECT comments_count FROM articles WHERE id=?').get(id).comments_count,0)
  await f.call('/comments/'+comment.body.id+'/review',{role:'admin',method:'POST',body:{approved:true}})
  const counts = await f.call('/data/articles?id=eq.' + id, { method: 'PATCH', body: { likes_count: 999, comments_count: 999 } })
  assert.equal(counts.body[0].likes_count, 1)
  assert.equal(counts.body[0].comments_count, 1)
  const deletion = await f.call('/data/article_likes?article_id=eq.' + id, { role: 'other', method: 'DELETE' })
  assert.equal(deletion.body.length, 0)
})

test('queries reject SQL identifiers, invalid selects and cross-site writes', async t => {
  const f = await fixture(t)
  assert.equal((await f.call('/data/users')).status, 404)
  assert.equal((await f.call('/data/articles?select=github_id')).status, 400)
  assert.equal((await f.call('/data/articles?order=id%3Bdrop%20table%20users.asc')).status, 400)
  assert.equal((await f.call('/data/articles', { role: 'admin', method: 'POST', body: { title: 'x', content: 'x' }, headers: { Origin: 'https://evil.example' } })).status, 403)
})

test('private favorites, reviews and resources remain private', async t => {
  const f = await fixture(t)
  const id = f.article()
  await f.call('/data/article_favorites', { role: 'user', method: 'POST', body: { article_id: id } })
  assert.equal((await f.call('/data/article_favorites', { role: 'other' })).body.length, 0)
  assert.equal((await f.call('/data/article_favorites', { role: 'user' })).body.length, 1)
  const change = await f.call('/data/profile_changes', { role: 'user', method: 'POST', body: { username: 'new', status: 'approved' } })
  assert.equal(change.body[0].status, 'pending')
  assert.equal((await f.call('/data/profile_changes', { role: 'other' })).body.length, 0)
  assert.equal((await f.call('/data/internal_resources', { role: 'user', method: 'POST', body: { title: 'x', file_url: 'https://example.com/x' } })).status, 403)
})

test('OAuth uses local callback and state, logout revokes the persisted session', async t => {
  const f = await fixture(t)
  const response = await fetch(f.base + '/api/auth/github', { redirect: 'manual' })
  const url = new URL(response.headers.get('location'))
  assert.equal(url.hostname, 'github.com')
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost/api/auth/github/callback')
  assert.ok(url.searchParams.get('state'))
  assert.equal((await f.call('/auth/github/callback?code=fake&state=wrong')).status, 302)
  assert.ok((await f.call('/auth/session', { role: 'user' })).body.session)
  await f.call('/auth/logout', { role: 'user', method: 'POST', body: {} })
  assert.equal((await f.call('/auth/session', { role: 'user' })).body.session, null)
})

test('uploaded internal files require membership and paths enforce ownership', async t => {
  const f = await fixture(t)
  const path = f.ids.member + '/file.zip'
  const upload = await fetch(f.base + '/api/storage/internal/' + path, { method: 'POST', headers: { Cookie: f.cookies.member, 'X-RD-CSRF': '1', 'Content-Type': 'application/octet-stream' }, body: 'example' })
  assert.equal(upload.status, 201)
  assert.equal((await fetch(f.base + '/api/files/internal/' + path)).status, 401)
  assert.equal((await fetch(f.base + '/api/files/internal/' + path, { headers: { Cookie: f.cookies.user } })).status, 403)
  const download = await fetch(f.base + '/api/files/internal/' + path, { headers: { Cookie: f.cookies.member } })
  assert.equal(download.status, 200)
  assert.match(download.headers.get('content-disposition'), /attachment/)
  const bad = await fetch(f.base + '/api/storage/avatars/' + f.ids.admin + '/file', { method: 'POST', headers: { Cookie: f.cookies.user, 'X-RD-CSRF': '1' }, body: 'test' })
  assert.equal(bad.status, 403)
})
