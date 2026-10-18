import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); document.body.innerHTML = ''
  delete window.__supabase; delete window.setProfileTab; delete window.saveProfileSettings
})
it('shares first-image cards between favorites and history, preserves reading time and formats Beijing timestamps', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearInterval'] })
  document.body.innerHTML = '<div id="profile-page"></div>'
  const articles = [{ id: 'one', title: '图文文章', summary: '摘要', first_image_url: '/first.png', cover_url: '/old.png', status: 'published' }, { id: 'two', title: '无图文章', status: 'published' }]
  const selections = []
  const remove = vi.fn(async () => ({ data: {} }))
  window.__supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test', user_metadata: {} } } } }) },
    reading: { history: async () => ({ data: { items: articles.map(a => ({ id: a.id, title: a.title, viewed_at: '2026-10-18T11:00:00Z', reading_seconds: 155 })), has_more: false } }), remove },
    from(table) {
      const result = { data: table === 'articles' ? articles : table === 'article_favorites' ? articles.map(a => ({ article_id: a.id, created_at: '2026-10-18T11:00:00Z' })) : [] }
      const query = { select: fields => { selections.push(fields); return query }, eq: () => query, order: () => query, in: () => query,
        maybeSingle: async () => ({ data: { username: '社员', role: 'user' } }), then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
      return query
    }
  }
  window.eval(readFileSync('docs/public/profile-page.js', 'utf8'))
  document.dispatchEvent(new Event('DOMContentLoaded'))
  await vi.advanceTimersByTimeAsync(1)
  await flushPromises()
  for (const panel of ['panel-favorites', 'panel-recent']) {
    const images = document.querySelectorAll('#' + panel + ' .article-card img')
    expect(images[0].getAttribute('src')).toBe('/first.png')
    expect(images[1].getAttribute('src')).toBe('/images/hero-bg.jpg')
    images[0].dispatchEvent(new Event('error'))
    expect(images[0].getAttribute('src')).toBe('/images/hero-bg.jpg')
  }
  expect(selections.some(fields => fields.includes('first_image_url'))).toBe(true)
  expect(document.querySelector('.profile-last-viewed').textContent).toBe('最近浏览 26/10/18/19:00')
  expect(document.getElementById('panel-recent').textContent).toContain('阅读 2 分 35 秒')
  expect(document.querySelector('[data-remove-history]').closest('a')).toBeNull()
  document.querySelector('[data-remove-history]').click()
  await flushPromises()
  expect(remove).toHaveBeenCalledWith('one')
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
