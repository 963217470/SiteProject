import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleCard from '../docs/.vitepress/theme/components/ArticleCard.vue'
import { articleCover, DEFAULT_ARTICLE_COVER, firstArticleImage } from '../docs/.vitepress/theme/lib/article-cover.mjs'
import { renderArticleMarkdown } from '../docs/.vitepress/theme/lib/markdown.mjs'
import { compileStyle } from '@vue/compiler-sfc'

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();document.body.innerHTML='';for(const name of ['toggleLike','toggleFavorite','scrollToTop','generateArticlePackage'])delete window[name]})

it('keeps image layout rules scoped to article elements instead of changing the app root',()=>{
  const source=readFileSync('docs/.vitepress/theme/components/ArticleCard.vue','utf8').match(/<style scoped>([\s\S]*?)<\/style>/)[1]
  const css=compileStyle({source,filename:'ArticleCard.vue',id:'data-v-test',scoped:true}).code
  expect(css).toContain('.rd-article.rd-article-discussion[data-v-test]')
  expect(css).toContain('object-fit:contain')
  expect(css).not.toMatch(/body #app\s*\{/)
})

it('finds the first rendered Markdown image including references, titles and nested parentheses, not code examples',()=>{
  expect(firstArticleImage('```md\n![example](/wrong.png)\n```\n\n![first](/api/files/notes/a/shot(1).png "caption")\n![later](/later.png)')).toBe('/api/files/notes/a/shot(1).png')
  expect(firstArticleImage('![first][screen]\n\n[screen]: /api/files/notes/a/screen.png "Screenshot"')).toBe('/api/files/notes/a/screen.png')
  expect(firstArticleImage('`![inline](/wrong.png)`\n\n![real](../images/real.png)')).toBe('/images/real.png')
})

it('uses the starry image for no content images, rejects unsafe schemes and ignores manually chosen covers',()=>{
  expect(articleCover({content:'# No image',cover_url:'https://example.com/old-cover.png'})).toBe(DEFAULT_ARTICLE_COVER)
  expect(firstArticleImage('![bad](javascript:alert(1))')).toBe('')
  expect(firstArticleImage('![bad](data:image/svg+xml;base64,aaaa)')).toBe('')
  expect(articleCover({first_image_url:'/api/files/notes/first.png',cover_url:'https://example.com/old.png'})).toBe('/api/files/notes/first.png')
})

it('always displays a left-hand cover in discussion cards and falls back on broken images',async()=>{
  const view=mount(ArticleCard,{props:{discussion:true,article:{id:'one',title:'Note',first_image_url:'/first.png',content:'![other](/other.png)'}}})
  const link=view.get('.rd-article-first-image')
  expect(link.element).toBe(view.element.firstElementChild)
  expect(link.get('img').attributes('src')).toBe('/first.png')
  await link.get('img').trigger('error')
  expect(link.get('img').attributes('src')).toBe(DEFAULT_ARTICLE_COVER)
  await view.setProps({article:{id:'one',title:'Note',first_image_url:'/new.png'}})
  expect(link.get('img').attributes('src')).toBe('/new.png')
  view.unmount()
})

it('renders a complete top image outside the reader column and supplies a fallback without changing the article',()=>{
  vi.useFakeTimers()
  document.body.innerHTML='<div id="article-page"><div id="article-shell"></div></div>'
  const script=readFileSync('docs/article/index.md','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
  const render=new Function('articleCover','DEFAULT_ARTICLE_COVER','renderMarkdown','articleBadges','articleTopicTags','copyMarkdownSelection',script+'\nreturn article => { articleState.article=article; renderArticle() }')(articleCover,DEFAULT_ARTICLE_COVER,renderArticleMarkdown,()=>[],()=>[],()=>{})
  render({id:'one',title:'Note',content:'![first](/first.png)',tags:[]})
  const banner=document.querySelector('.article-top-cover')
  expect(banner.nextElementSibling.className).toBe('article-stage')
  expect(banner.querySelector('img').getAttribute('src')).toBe('/first.png')
  expect(document.querySelector('.reader-card .cover-frame')).toBeNull()
  banner.querySelector('img').dispatchEvent(new Event('error'))
  expect(banner.querySelector('img').getAttribute('src')).toBe(DEFAULT_ARTICLE_COVER)
  render({id:'two',title:'No image',content:'# Text only',tags:[]})
  expect(document.querySelector('.article-first-image').getAttribute('src')).toBe(DEFAULT_ARTICLE_COVER)
})
