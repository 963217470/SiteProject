import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ArticleLibrary from '../docs/.vitepress/theme/components/ArticleLibrary.vue'

let wrapper, rows, error, calls, callback, unsubscribe
beforeEach(() => {
  rows = Array.from({ length: 15 }, (_, i) => ({ id: String(i), title: `Article ${i}`, summary: 'A note', tags: [i % 2 ? 'Unity' : 'Godot'], visibility: i % 2 ? 'internal' : 'public', created_at: `2026-10-${String(i + 1).padStart(2, '0')}`, likes_count: i, comments_count: 15 - i }))
  error = null; calls = []; unsubscribe = vi.fn()
  window.__api = {
    from: () => {
      const state = { filters: {}, limit: 500, offset: 0 }
      calls.push(state)
      const query = { select: () => query, eq: (key, value) => { state.filters[key] = value; return query }, order: () => query, limit: value => { state.limit = value; return query }, offset: value => { state.offset = value; return query }, then: resolve => Promise.resolve({ data: rows.filter(a => !state.filters.visibility || a.visibility === state.filters.visibility).slice(state.offset, state.offset + state.limit), error }).then(resolve) }
      return query
    },
    auth: { onAuthStateChange: cb => { callback = cb; return { data: { subscription: { unsubscribe } } } } }
  }
})
afterEach(() => { wrapper?.unmount(); delete window.__api; window.history.replaceState(null, '', '/') })
async function render(props = {}) { wrapper = mount(ArticleLibrary, { props }); await flushPromises() }
describe('Article library', () => {
  it('paginates and resets the page when searching', async () => {
    await render()
    expect(wrapper.findAll('.rd-article')).toHaveLength(12)
    await wrapper.get('.rd-pagination button:last-child').trigger('click')
    expect(wrapper.findAll('.rd-article')).toHaveLength(3)
    await wrapper.get('input[type="search"]').setValue('Article 14')
    expect(wrapper.findAll('.rd-article')).toHaveLength(1)
    expect(wrapper.get('.rd-article h2').text()).toBe('Article 14')
  })
  it('filters visibility and tags, sorts and switches layout', async () => {
    await render()
    await wrapper.get('.rd-segments button:nth-child(2)').trigger('click')
    expect(wrapper.findAll('.rd-article')).toHaveLength(8)
    await wrapper.get('select').setValue('discussed')
    expect(wrapper.findAll('.rd-article h2')[0].text()).toBe('Article 0')
    await wrapper.get('[aria-label="网格视图"]').trigger('click')
    expect(wrapper.find('.rd-article-grid').exists()).toBe(true)
    await wrapper.get('[aria-label="筛选标签 Godot"]').trigger('click')
    expect(wrapper.get('.rd-filter-summary').text()).toBe('Godot')
  })
  it('shows an empty state and allows clearing a search', async () => {
    await render()
    await wrapper.get('input').setValue('no match')
    expect(wrapper.findAll('.rd-article')).toHaveLength(0)
    await wrapper.get('.rd-state button').trigger('click')
    expect(wrapper.findAll('.rd-article')).toHaveLength(12)
  })
  it('retries errors and unsubscribes from auth changes', async () => {
    error = { message: 'Offline' }
    await render()
    expect(wrapper.get('[role="alert"]').text()).toContain('Offline')
    error = null
    await wrapper.get('.rd-state button').trigger('click'); await flushPromises()
    expect(wrapper.findAll('.rd-article')).toHaveLength(12)
    callback('SIGNED_OUT'); await flushPromises()
    expect(calls).toHaveLength(3)
    wrapper.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
  it('loads only three public posts on the homepage', async () => {
    await render({ compact: true })
    expect(calls[0].filters.visibility).toBe('public')
    expect(wrapper.findAll('.rd-article')).toHaveLength(3)
    expect(wrapper.find('input').exists()).toBe(false)
  })
  it('continues beyond a full API batch without truncating results', async () => {
    rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i), title: `Note ${i}`, tags: [], visibility: 'public' }))
    await render()
    expect(calls.map(c => c.offset)).toEqual([0, 500])
    expect(wrapper.get('.rd-results').text()).toBe('501 篇文章')
  })
})
