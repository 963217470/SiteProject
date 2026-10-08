import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); document.body.innerHTML = ''
  delete window.__supabase; delete window.setProfileTab; delete window.saveProfileSettings
})
it('an unavailable history service does not block publications or the profile', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearInterval'] })
  document.body.innerHTML = '<div id="profile-page"></div>'
  const profile = { id: 'test', username: '社员', role: 'user' }
  window.__supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test', user_metadata: {} } } } }) },
    reading: { history: async () => ({ error: { message: '浏览记录维护中' } }) },
    from(table) {
      const result = { data: table === 'articles' ? [{ id: 'one', title: '已有文章', status: 'published' }] : [] }
      const query = { select: () => query, eq: () => query, order: () => query, in: () => query,
        maybeSingle: async () => ({ data: profile }), then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
      return query
    }
  }
  window.eval(readFileSync('docs/public/profile-page.js', 'utf8'))
  document.dispatchEvent(new Event('DOMContentLoaded'))
  await vi.advanceTimersByTimeAsync(1)
  await flushPromises()
  expect(document.getElementById('profile-app').style.display).toBe('block')
  expect(document.getElementById('panel-articles').textContent).toContain('已有文章')
  expect(document.getElementById('panel-recent').textContent).toContain('浏览记录维护中')
  expect(document.getElementById('retry-reading-history')).not.toBeNull()
})
