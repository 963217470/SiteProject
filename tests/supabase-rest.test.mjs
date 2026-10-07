import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../docs/public/supabase-rest.js', import.meta.url), 'utf8')
const token = 'header.' + Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url') + '.signature'

function client(session, respond = () => ({})) {
  const values = new Map(session ? [['sb-auth-token', JSON.stringify(session)]] : [])
  const calls = []
  const context = {
    window: { location: { origin: 'https://rd-studio.club' } },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    fetch: async (url, options) => {
      calls.push({ url, options })
      const body = respond(url, options)
      return { ok: true, text: async () => JSON.stringify(body), json: async () => body }
    }
  }
  vm.runInNewContext(source, context)
  return { sb: context.window.__supabase, calls, window: context.window }
}

test('authenticated uploads use the user token', async () => {
  const { sb, calls } = client({ access_token: token, expires_at: Date.now() / 1000 + 3600 })
  await sb.storage.from('avatars').upload('user-1/avatar.png', { type: 'image/png' })
  assert.equal(calls[0].options.headers.authorization, 'Bearer ' + token)
})

test('anonymous uploads do not send a request', async () => {
  const { sb, calls } = client()
  const result = await sb.storage.from('avatars').upload('avatar.png', {})
  assert.ok(result.error)
  assert.equal(calls.length, 0)
})

test('expired persisted sessions refresh before uploading', async () => {
  const { sb, calls } = client({ access_token: token, refresh_token: 'refresh', expires_at: 1 },
    url => url.includes('/auth/v1/token') ? { access_token: token, refresh_token: 'new', expires_in: 3600 } : {})
  await sb.storage.from('avatars').upload('avatar.png', {})
  assert.match(calls[0].url, /grant_type=refresh_token/)
  assert.equal(calls[1].options.headers.authorization, 'Bearer ' + token)
})

test('OAuth uses the new project and production callback', async () => {
  const { sb, window } = client()
  await sb.auth.signInWithOAuth({ provider: 'github' })
  const url = new URL(window.location.href)
  assert.equal(url.hostname, 'uulmgatzihdtbzrqaocc.supabase.co')
  assert.equal(url.searchParams.get('redirect_to'), 'https://rd-studio.club/auth/callback')
})

test('article writes use the user token and author ID', async () => {
  const { sb, calls } = client({ access_token: token, expires_at: Date.now() / 1000 + 3600 })
  await sb.from('articles').insert({ title: 'Article', status: 'published', author_id: 'other' })
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ' + token)
  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.author_id, 'user-1')
  assert.equal(body.status, 'pending')
})
