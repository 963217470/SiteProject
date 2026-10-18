import { readFileSync } from 'node:fs'
import { compileStyle } from '@vue/compiler-sfc'
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import CommunityLinks from '../docs/.vitepress/theme/components/CommunityLinks.vue'

it('preserves all three homepage destinations', () => {
  const view = mount(CommunityLinks)
  expect(view.findAll('a').map(link => link.attributes('href'))).toEqual(['/tasks', '/kb', '/about'])
  expect(view.findAll('strong').map(title => title.text())).toEqual(['今天也推进一点点', '知识库', '认识 RD STUDIO'])
  view.unmount()
})

it('applies the same theme-aware colors to every shortcut, with shared hover and focus feedback', () => {
  const source = readFileSync('docs/.vitepress/theme/components/CommunityLinks.vue', 'utf8').match(/<style scoped>([\s\S]*?)<\/style>/)[1]
  const result = compileStyle({ source, filename: 'CommunityLinks.vue', id: 'data-v-test', scoped: true })
  expect(result.errors).toEqual([])
  expect(result.code).toMatch(/body #app \.VPHome \.community-links a\[data-v-test\]\s*\{\s*background: var\(--vp-c-bg-soft\);\s*border-color: var\(--rd-card-border\);\s*\}/)
  expect(result.code).toContain('color: var(--vp-c-text-1)')
  expect(result.code).toContain(':is(:hover, :focus-visible)')
  expect(result.code).not.toMatch(/nth-child|body #app\s*\{/)
})
