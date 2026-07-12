import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true }
})

try {
  const { sanitizeRedirectPath } = await server.ssrLoadModule('/docs/.vitepress/theme/lib/authRedirect.ts')

  assert.equal(sanitizeRedirectPath('/articles?tag=Vue#latest'), '/articles?tag=Vue#latest')
  assert.equal(sanitizeRedirectPath('/user/profile'), '/user/profile')
  assert.equal(sanitizeRedirectPath('https://evil.example/steal'), '/')
  assert.equal(sanitizeRedirectPath('//evil.example/steal'), '/')
  assert.equal(sanitizeRedirectPath('/\\evil.example/steal'), '/')
  assert.equal(sanitizeRedirectPath('/auth/callback'), '/')
  assert.equal(sanitizeRedirectPath('/login'), '/')
  assert.equal(sanitizeRedirectPath('javascript:alert(1)'), '/')
  assert.equal(sanitizeRedirectPath('/safe\u0000path'), '/')
  assert.equal(sanitizeRedirectPath(null), '/')

  console.log('OAuth redirect validation tests passed.')
} finally {
  await server.close()
}
