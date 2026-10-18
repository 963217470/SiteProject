import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProfileMcpPanel from '../docs/.vitepress/theme/components/ProfileMcpPanel.vue'
import ProfileCatalogPanel from '../docs/.vitepress/theme/components/ProfileCatalogPanel.vue'

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
  let articles = [{ id: 'mine', title: 'My article', status: 'draft', summary:'My summary', first_image_url:'/first-note.png', tags:['Godot'], views_count:3, likes_count:2, comments_count:1 }]
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

it('my games and tools is a private profile tab mounted only while selected',async()=>{
  await open();wrapper=mount(ProfileCatalogPanel,{attachTo:document.body})
  expect(document.querySelector('#tab-catalog').textContent).toBe('我的游戏/工具')
  window.setProfileTab('catalog');await flushPromises()
  expect(location.search).toBe('?tab=catalog');expect(document.querySelector('#panel-catalog h2').textContent).toBe('我的游戏/工具')
  window.setProfileTab('articles');await flushPromises()
  expect(document.querySelector('#panel-catalog .profile-catalog')).toBeNull()
})

it('owned articles use the same large-cover feed layout without losing management controls',async()=>{
  await open()
  const card=document.querySelector('.article-row.profile-feed-card')
  expect(card.firstElementChild.className).toBe('profile-feed-cover')
  expect(card.querySelector('.profile-feed-cover img').getAttribute('src')).toBe('/first-note.png')
  expect(card.querySelector('.profile-feed-name').textContent).toBe('Me')
  expect(card.querySelector('.profile-feed-summary').textContent).toBe('My summary')
  expect(card.querySelector('.profile-feed-tags').textContent).toBe('Godot')
  expect(card.querySelector('.profile-feed-counts').textContent).toContain('浏览 3')
  expect(card.querySelector('.profile-feed-actions a[href="/editor?id=mine"]')).not.toBeNull()
  expect(card.querySelector('.article-delete')).not.toBeNull()
  const image=card.querySelector('.profile-feed-cover img');image.dispatchEvent(new Event('error'));expect(image.getAttribute('src')).toBe('/images/hero-bg.jpg')
})

it('shared profile feed styles use the article-page proportions, contain images and stack on phones',()=>{
  const css=readFileSync('docs/.vitepress/theme/profile-feed.css','utf8')
  expect(css).toContain('grid-template-columns:minmax(0,38%) minmax(0,1fr)')
  expect(css).toContain('object-fit:contain')
  expect(css).toContain('@media(max-width:700px)')
  expect(css).toContain('prefers-reduced-motion:reduce')
  expect(readFileSync('docs/public/profile-page.js','utf8')).toContain('cover_url, first_image_url, tags')
})
