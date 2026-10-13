import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleCard from '../docs/.vitepress/theme/components/ArticleCard.vue'
import { articleBadges, productionTag, withProductionTag } from '../docs/.vitepress/theme/lib/article-badges.mjs'
describe('article badges', () => {
  it('shows actual collection and chosen production labels at the trailing edge', () => {
    const view = mount(ArticleCard, { props: { article: { id:'a',title:'Note',status:'published',kb_enabled:true,tags:['Godot','视频转文'] } } })
    expect(view.get('.rd-article-trailing .article-badge-knowledge').text()).toBe('知识库')
    expect(view.get('.article-badge-video').text()).toBe('视频转文')
    expect(view.get('.rd-tags').text()).toBe('Godot')
    expect(view.get('.rd-article-counts').exists()).toBe(true)
  })
  it('does not mistake an unapproved article or typed topic for collection', () => {
    expect(articleBadges({ status:'pending',kb_enabled:true,tags:['知识库'] })).toEqual([])
    expect(articleBadges({ status:'published',kb_enabled:false,tags:['知识库'] })).toEqual([])
  })
  it('uses yellow for manual work without guessing legacy provenance', () => {
    const view = mount(ArticleCard, { props: { article: { id:'a',title:'Note',tags:['手搓'] } } })
    expect(view.get('.article-badge-manual').text()).toBe('手搓')
    expect(articleBadges({tags:[]})).toEqual([])
    expect(productionTag(['视频转文','手搓'])).toBe('')
  })
  it('changing the source preserves topics and removes the previous source', () => {
    expect(withProductionTag(['Godot','视频转文'],'手搓')).toEqual(['Godot','手搓'])
    expect(withProductionTag(['Godot','手搓'],'')).toEqual(['Godot'])
  })
})
