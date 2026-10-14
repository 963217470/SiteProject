import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CatalogCenter from '../docs/.vitepress/theme/components/CatalogCenter.vue'
import { catalogRequest } from '../docs/.vitepress/theme/lib/catalog-api.mjs'
import { renderCatalogMarkdown } from '../docs/.vitepress/theme/lib/catalog-markdown.mjs'
vi.mock('../docs/.vitepress/theme/lib/catalog-api.mjs',()=>({catalogRequest:vi.fn(),uploadCatalogFile:vi.fn(),removeUnusedCatalogFiles:vi.fn()}))
let wrapper,sessionCallback
beforeEach(()=>{
  history.replaceState(null,'','/')
  window.__api={auth:{onAuthStateChange:vi.fn(callback=>{sessionCallback=callback;return {data:{subscription:{unsubscribe:vi.fn()}}}})}}
  catalogRequest.mockReset().mockResolvedValue({items:[],has_more:false})
})
afterEach(()=>wrapper?.unmount())
it('anonymous visitors can browse and see login without publication controls',async()=>{
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',null);await flushPromises();expect(wrapper.text()).toContain('暂无作品');expect(wrapper.text()).toContain('登录');expect(wrapper.text()).not.toContain('发布作品')
})
it('failed catalogs isolate error and support retry',async()=>{
  catalogRequest.mockRejectedValueOnce(new Error('Offline'));wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',null);await flushPromises();expect(wrapper.text()).toContain('Offline');await wrapper.findAll('button').find(b=>b.text()==='重试').trigger('click');await flushPromises();expect(wrapper.text()).toContain('暂无作品')
})
it('homepage artwork links open the existing detail and download view',async()=>{
  history.replaceState(null,'','/games-tools/?id=shared-game')
  catalogRequest.mockImplementation(async path=>path==='/shared-game'?{id:'shared-game',title:'Shared game',content:'# Introduction',assets:[],status:'published',kind:'game',downloads:0,external_url:'https://pan.baidu.com/s/demo'}:{items:[],has_more:false})
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',null);await flushPromises();expect(wrapper.text()).toContain('Shared game');expect(wrapper.text()).toContain('外部下载');expect(catalogRequest).toHaveBeenCalledWith('/shared-game')
})
it('signed in authors can edit markdown and submit owned asset identifiers',async()=>{
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',{user:{id:'author',app_metadata:{role:'user'}}});await flushPromises()
  await wrapper.findAll('button').find(b=>b.text()==='发布作品').trigger('click')
  await wrapper.find('input[maxlength="120"]').setValue('My tool');await wrapper.find('.catalog-source').setValue('# My tool')
  catalogRequest.mockImplementation(async(path,opts)=>opts?.method==='POST'?{id:'new',status:'pending'}:{id:'new',title:'My tool',content:'# My tool',assets:[],author_id:'author',status:'pending'})
  await wrapper.find('.catalog-editor').trigger('submit');await flushPromises()
  expect(catalogRequest).toHaveBeenCalledWith('',expect.objectContaining({method:'POST',body:expect.objectContaining({title:'My tool',status:'pending',assets:[]})}));expect(wrapper.text()).toContain('已提交审核')
})
it('safe markdown supports images formulas and blocks raw html and script urls',()=>{
  const html=renderCatalogMarkdown('# Title\n\n![Screenshot](https://example.com/test.png)\n\n$x^2$\n\n```js\nalert(1)\n```\n\n<script>alert(1)</script>\n[x](javascript:alert(1))')
  expect(html).toMatch(/<h1[^>]*>Title/);expect(html).toContain('<img');expect(html).toContain('katex');expect(html).toContain('language-js');expect(html).not.toContain('<script>');expect(html).not.toContain('href="javascript:')
})
