import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../docs/public/api-client.js', import.meta.url), 'utf8')
function fixture(result = []) {
  const calls = []
  const removed = []
  const context = {
    window: { location: { origin: 'https://rd-studio.club' } }, URLSearchParams,
    localStorage: { removeItem: key => removed.push(key) },
    fetch: async (url, options) => {
      calls.push({ url, options })
      return { ok: true, json: async () => result, headers: { get: () => null } }
    }
  }
  vm.runInNewContext(source, context)
  return { client: context.window.__api, window: context.window, calls, removed }
}
test('all data requests stay on the server and writes include CSRF header', async () => {
  const { client, calls, removed } = fixture([])
  await client.from('articles').update({ status: 'pending' }).eq('id', 'article')
  assert.match(calls[0].url, /^\/api\/data\/articles\?/)
  assert.equal(calls[0].options.credentials, 'same-origin')
  assert.equal(calls[0].options.headers['X-RD-CSRF'], '1')
  assert.ok(removed.includes('sb-auth-token'))
})
test('maybeSingle accepts zero rows and single rejects them', async () => {
  const { client } = fixture([])
  assert.equal((await client.from('profiles').maybeSingle()).data, null)
  assert.ok((await client.from('profiles').single()).error)
})
test('login redirects directly to server GitHub OAuth', async () => {
  const { client, window } = fixture({ github: true })
  await client.auth.signInWithOAuth({ provider: 'github' })
  assert.equal(window.location.href, '/api/auth/github')
})
test('file links are same-origin and uploads use cookie authentication', async () => {
  const { client, calls } = fixture({ path: 'file' })
  await client.storage.from('internal').upload('user/file.zip', { type: 'application/zip' })
  assert.equal(calls[0].url, '/api/storage/internal/user/file.zip')
  assert.equal(calls[0].options.credentials, 'same-origin')
  assert.equal(client.storage.from('internal').getPublicUrl('user/file.zip').data.publicUrl, 'https://rd-studio.club/api/files/internal/user/file.zip')
})
