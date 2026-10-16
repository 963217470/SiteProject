import { expect, it, vi } from 'vitest'
vi.mock('vitepress',()=>({defineConfig:config=>config}))
import config from '../docs/.vitepress/config.ts'

it('exposes a standalone mindmap navigation entry after knowledge with exclusive selection',()=>{
  const nav=config.themeConfig.nav
  const index=nav.findIndex(item=>item.text==='思维导图')
  expect(index).toBeGreaterThan(0)
  expect(nav[index-1].text).toBe('知识库')
  expect(nav[index].link).toBe('/mindmap/')
  const selected=path=>nav.filter(item=>item.activeMatch&&new RegExp(item.activeMatch).test(path)).map(item=>item.text)
  expect(selected('/mindmap')).toEqual(['思维导图'])
  expect(selected('/mindmap/')).toEqual(['思维导图'])
  expect(selected('/kb/')).toEqual(['知识库'])
  expect(selected('/admin/kb')).toEqual(['知识库'])
  expect(selected('/articles/')).toEqual(['文章'])
})
