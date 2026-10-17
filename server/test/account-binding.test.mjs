import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'
import { openDatabase } from '../database.mjs'
import { Repository } from '../repository.mjs'
import { createApp } from '../app.mjs'
import { acceptBindingIdentity, confirmBinding } from '../account-binding.mjs'
import { Strategy as GitHubStrategy } from 'passport-github2'
import { OAuth2 } from 'oauth'

function fixture(t) {
  const db = openDatabase(':memory:')
  for (const [id, gh] of [['owner', 'old'], ['other', 'taken']]) {
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(id, gh, gh)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(id, id, 'user')
  }
  const repository = new Repository(db)
  const user = { id: 'owner', role: 'user' }
  const session = { githubBinding: { owner: 'owner', original: 'old', expires: 2000, stage: 'verify-original' } }
  t.after(() => db.close())
  return { db, repository, user, session }
}

test('binding requires both identities, explicit confirmation and preserves original profile and articles', t => {
  const f = fixture(t)
  const article = f.repository.insert('articles', { title: 'Original article', content: 'Retained', visibility: 'public' }, f.user)
  assert.throws(() => confirmBinding(f.db, f.repository, f.session, f.user, 'current', 1000), /请先验证/)
  acceptBindingIdentity(f.db, f.session, f.user, { id: 'old' }, 1000)
  assert.equal(f.session.githubBinding.stage, 'choose-new')
  f.session.githubBinding.stage = 'verify-new'
  acceptBindingIdentity(f.db, f.session, f.user, { id: 'new', username: 'new-name' }, 1000)
  assert.equal(f.db.prepare('SELECT github_id FROM users WHERE id=?').get('owner').github_id, 'old')
  for (const sid of ['current', 'elsewhere']) f.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid, JSON.stringify({ passport: { user: 'owner' } }), 3000)
  f.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('unrelated', JSON.stringify({ passport: { user: 'other' } }), 3000)
  f.db.prepare('INSERT INTO mcp_tokens(id,user_id,name,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)').run('token', 'owner', 'Old token', 'hash', 0, 3000)
  confirmBinding(f.db, f.repository, f.session, f.user, 'current', 1000)
  assert.equal(f.db.prepare('SELECT github_id FROM users WHERE id=?').get('owner').github_id, 'new')
  assert.equal(f.db.prepare('SELECT username FROM profiles WHERE id=?').get('owner').username, 'owner')
  assert.equal(f.db.prepare('SELECT author_id FROM articles WHERE id=?').get(article.id).author_id, 'owner')
  assert.deepEqual(f.db.prepare('SELECT sid FROM sessions ORDER BY sid').all().map(x => x.sid), ['current', 'unrelated'])
  assert.equal(f.db.prepare('SELECT revoked_at FROM mcp_tokens WHERE id=?').get('token').revoked_at, 1000)
  assert.equal(f.db.prepare('SELECT count(*) n FROM notifications WHERE user_id=?').get('owner').n, 1)
  assert.throws(() => confirmBinding(f.db, f.repository, f.session, f.user, 'current', 1000), /过期/)
})

test('binding rejects wrong old identity, expired/foreign flows, taken accounts and configured admins', t => {
  const f = fixture(t)
  assert.throws(() => acceptBindingIdentity(f.db, f.session, f.user, { id: 'wrong' }, 1000), /当前绑定/)
  assert.throws(() => acceptBindingIdentity(f.db, f.session, { id: 'other' }, { id: 'old' }, 1000), /过期/)
  assert.throws(() => acceptBindingIdentity(f.db, f.session, f.user, { id: 'old' }, 2000), /过期/)
  f.session.githubBinding.stage = 'verify-new'
  for (const [id, message] of [['old', /另一个/], ['taken', /已绑定/], ['admin', /管理员/]]) assert.throws(() => acceptBindingIdentity(f.db, f.session, f.user, { id, username: id }, 1000, ['admin']), message)
  acceptBindingIdentity(f.db, f.session, f.user, { id: 'new', username: 'new' }, 1000)
  assert.throws(() => confirmBinding(f.db, f.repository, f.session, f.user, 'current', 1000, ['old']), /运维/)
  f.db.prepare('UPDATE users SET github_id=? WHERE id=?').run('new', 'other')
  assert.throws(() => confirmBinding(f.db, f.repository, f.session, f.user, 'current', 1000), /已被绑定/)
  assert.equal(f.db.prepare('SELECT github_id FROM users WHERE id=?').get('owner').github_id, 'old')
})

test('account routes enforce session, CSRF, step order and one-use authorization nonce', async t => {
  const f = fixture(t)
  const dataDir = mkdtempSync(join(tmpdir(), 'rd-binding-'))
  const secret = 'test-secret-for-account-binding-12345'
  const app = createApp(f.db, { dataDir, production: false, sessionSecret: secret, siteUrl: 'https://rd-studio.club', maxUploadMb: 1, adminGithubIds: [], githubClientId: 'test-client', githubClientSecret: 'test-secret' })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(dataDir, { recursive: true, force: true }) })
  const sid = 'owner-session'
  f.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid, JSON.stringify({ passport: { user: 'owner' }, cookie: { expires: new Date(Date.now() + 60000), path: '/' } }), Date.now() + 60000)
  const cookie = 'rd.sid=' + encodeURIComponent('s:' + sid + '.' + createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, ''))
  const base = 'http://127.0.0.1:' + server.address().port
  const headers = { Cookie: cookie, 'Content-Type': 'application/json', 'X-RD-CSRF': '1' }
  assert.equal((await fetch(base + '/api/account/github')).status, 401)
  assert.equal((await fetch(base + '/api/account/github/start', { method: 'POST', headers: { Cookie: cookie } })).status, 403)
  assert.equal((await fetch(base + '/api/account/github/start', { method: 'POST', headers, body: '{"step":"new"}' })).status, 409)
  const start = await fetch(base + '/api/account/github/start', { method: 'POST', headers, body: '{}' })
  assert.equal(start.status, 200)
  const { authorization_url } = await start.json()
  const auth = await fetch(base + authorization_url, { headers, redirect: 'manual' })
  assert.equal(auth.status, 302)
  const redirect = new URL(auth.headers.get('location'))
  assert.equal(redirect.origin, 'https://github.com')
  assert.equal(redirect.searchParams.get('prompt'), 'select_account')
  assert.ok(redirect.searchParams.get('state'))
  assert.equal((await fetch(base + authorization_url, { headers, redirect: 'manual' })).status, 403)
  assert.equal((await fetch(base + '/api/account/github/confirm', { method: 'POST', headers, body: '{}' })).status, 409)
  assert.equal((await fetch(base + '/api/account/github', { method: 'DELETE', headers })).status, 200)
  assert.equal((await (await fetch(base + '/api/account/github', { headers })).json()).stage, 'idle')
})

test('OAuth callbacks verify both identities without switching session; normal GitHub login still works', async t => {
  const f = fixture(t)
  let identity = { id: 'old', username: 'old' }
  const oldToken = OAuth2.prototype.getOAuthAccessToken
  const oldProfile = GitHubStrategy.prototype.userProfile
  OAuth2.prototype.getOAuthAccessToken = (_code, _params, done) => done(null, 'test-only-token', '', {})
  GitHubStrategy.prototype.userProfile = (_token, done) => done(null, identity)
  t.after(() => { OAuth2.prototype.getOAuthAccessToken = oldToken; GitHubStrategy.prototype.userProfile = oldProfile })
  const dataDir = mkdtempSync(join(tmpdir(), 'rd-binding-oauth-'))
  const secret = 'test-secret-for-account-binding-12345'
  const app = createApp(f.db, { dataDir, production: false, sessionSecret: secret, siteUrl: 'https://rd-studio.club', maxUploadMb: 1, adminGithubIds: [], githubClientId: 'test-client', githubClientSecret: 'test-secret' })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(dataDir, { recursive: true, force: true }) })
  const sid = 'oauth-owner-session'
  f.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sid, JSON.stringify({ passport: { user: 'owner' }, cookie: { expires: new Date(Date.now() + 60000), path: '/' } }), Date.now() + 60000)
  let cookie = 'rd.sid=' + encodeURIComponent('s:' + sid + '.' + createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, ''))
  const base = 'http://127.0.0.1:' + server.address().port
  const call = (path, method = 'GET', body) => fetch(base + path, { method, redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-RD-CSRF': '1' }, body: body ? JSON.stringify(body) : undefined })
  for (const step of ['original', 'new']) {
    identity = step === 'original' ? { id: 'old', username: 'old' } : { id: 'new', username: 'new' }
    const start = await (await call('/api/account/github/start', 'POST', { step })).json()
    const auth = await call(start.authorization_url)
    const state = new URL(auth.headers.get('location')).searchParams.get('state')
    const callback = await call('/api/auth/github/callback?code=test&state=' + state)
    assert.equal(callback.status, 302)
    assert.equal(callback.headers.get('location'), '/user/profile?tab=security')
    const account = await (await call('/api/auth/session')).json()
    assert.equal(account.session.user.id, 'owner')
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM users').get().n, 2)
  assert.equal(f.db.prepare('SELECT github_id FROM users WHERE id=?').get('owner').github_id, 'old')
  assert.equal((await call('/api/account/github/confirm', 'POST', {})).status, 200)
  const login = await call('/api/auth/github')
  const state = new URL(login.headers.get('location')).searchParams.get('state')
  const loggedIn = await call('/api/auth/github/callback?code=test&state=' + state)
  assert.equal(loggedIn.status, 302)
  assert.equal(loggedIn.headers.get('location'), '/auth/callback')
  cookie = loggedIn.headers.getSetCookie().find(value => value.startsWith('rd.sid=')).split(';')[0]
  assert.equal((await (await call('/api/auth/session')).json()).session.user.id, 'owner')
})
