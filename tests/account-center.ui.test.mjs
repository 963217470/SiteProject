import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProfileMcpPanel from '../docs/.vitepress/theme/components/ProfileMcpPanel.vue'

let wrapper
afterEach(() => {
  wrapper?.unmount(); wrapper = null
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals()
  document.body.innerHTML = ''; history.replaceState({}, '', '/')
  delete window.__supabase; delete window.setProfileTab; delete window.saveProfileSettings
})

async function open() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearInterval'] })
  history.replaceState({}, '', '/user/profile?tab=articles')
  document.body.innerHTML = '<div id="profile-page"></div>'
  let articles = [{ id: 'mine', title: 'My article', status: 'draft' }]
  const removed = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async path => ({ ok: true, json: async () => path === '/api/account/github' ? { username: 'old-github', available: true, stage: 'idle' } : path === '/api/auth/session' ? { session: { user: { id: 'owner' } } } : path === '/api/mcp-tokens' ? [] : {} })))
  window.__supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner', user_metadata: {} } } } }) },
    reading: { history: async () => ({ data: { items: [] } }) },
    from(table) {
      let deleting = false
      const query = { select: () => query, eq: () => query, order: () => query, in: () => query,
        delete: () => { deleting = true; return query }, maybeSingle: async () => ({ data: { id: 'owner', username: 'Me', role: 'user' } }),
        then(resolve) { if (deleting) { removed(); articles = []; return Promise.resolve({ data: [{ id: 'mine' }] }).then(resolve) } return Promise.resolve({ data: table === 'articles' ? articles : [] }).then(resolve) }
      }
      return query
    }
  }
  window.eval(readFileSync('docs/public/profile-page.js', 'utf8'))
  document.dispatchEvent(new Event('DOMContentLoaded'))
  await vi.advanceTimersByTimeAsync(1); await flushPromises()
  return { removed }
}

it('own articles retain editor links and deletion requires confirmation, then refreshes rows and counts', async () => {
  const { removed } = await open()
  expect(document.querySelector('.row-actions a[href="/editor?id=mine"]')).not.toBeNull()
  const confirm = vi.fn(() => false)
  vi.stubGlobal('confirm', confirm)
  document.querySelector('.article-delete').click(); await flushPromises()
  expect(removed).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  document.querySelector('.article-delete').click(); await flushPromises()
  expect(removed).toHaveBeenCalledOnce()
  expect(document.querySelectorAll('.article-row')).toHaveLength(0)
  expect(document.querySelector('#panel-articles').textContent).toContain('暂无文章')
})

it('MCP belongs to the private profile tab and its token form unmounts when leaving', async () => {
  await open()
  wrapper = mount(ProfileMcpPanel, { attachTo: document.body })
  window.setProfileTab('mcp'); await flushPromises()
  expect(document.querySelector('#panel-mcp .upload-tokens')).not.toBeNull()
  expect(document.querySelector('#panel-mcp a[href="/user/mcp/"]')).not.toBeNull()
  window.setProfileTab('articles'); await flushPromises()
  expect(document.querySelector('#panel-mcp .upload-tokens')).toBeNull()
})

it('account security displays actual bound GitHub account without changing public profile', async () => {
  await open()
  window.setProfileTab('security'); await flushPromises()
  expect(document.querySelector('#panel-security').textContent).toContain('old-github')
  expect(document.querySelector('#panel-security').textContent).toContain('验证原 GitHub 账号')
  expect(document.querySelector('#profile-name').textContent).toBe('Me')
})
