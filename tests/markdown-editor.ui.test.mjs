import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import ArticleEditor from '../docs/.vitepress/theme/components/ArticleEditor.vue'

let wrapper
afterEach(() => { wrapper?.unmount(); delete window.__supabase })
it('keeps original Markdown byte-for-byte through preview, blur and saving a draft', async () => {
  const source = readFileSync('docs/public/examples/markdown-compatibility.md', 'utf8')
  const insert = vi.fn()
  const query = { select: () => query, order: async () => ({ data: [] }), insert: data => { insert(data); return query }, single: async () => ({ data: { id: 'draft-test' } }) }
  window.__supabase = { from: () => query, auth: { getSession: async () => ({ data: { session: { user: { id: 'author' } } } }) } }
  wrapper = mount(ArticleEditor)
  await flushPromises()
  await wrapper.get('.title-field input').setValue('Compatibility test')
  const textarea = wrapper.get('textarea.content-editor')
  await textarea.setValue(source)
  expect(wrapper.find('.katex-error').exists()).toBe(false)
  const preview = wrapper.get('.preview-body')
  expect(preview.attributes('contenteditable')).toBeUndefined()
  await preview.trigger('blur')
  await wrapper.findAll('button').find(b => b.text() === '预览').trigger('click')
  await wrapper.findAll('button').find(b => b.text() === 'Markdown').trigger('click')
  expect(textarea.element.value).toBe(source)
  await wrapper.findAll('button').find(b => b.text().includes('保存草稿')).trigger('click')
  await flushPromises()
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ content: source, status: 'draft' }))
})
