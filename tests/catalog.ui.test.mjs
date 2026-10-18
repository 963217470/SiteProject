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
  expect(wrapper.find('[aria-label="发布用户"]').exists()).toBe(false)
  await wrapper.find('input[maxlength="120"]').setValue('My tool');await wrapper.find('.catalog-source').setValue('# My tool')
  catalogRequest.mockImplementation(async(path,opts)=>opts?.method==='POST'?{id:'new',status:'pending'}:{id:'new',title:'My tool',content:'# My tool',assets:[],author_id:'author',status:'pending'})
  await wrapper.find('.catalog-editor').trigger('submit');await flushPromises()
  expect(catalogRequest).toHaveBeenCalledWith('',expect.objectContaining({method:'POST',body:expect.objectContaining({title:'My tool',status:'pending',assets:[]})}));expect(wrapper.text()).toContain('已提交审核')
})
it('safe markdown supports images formulas and blocks raw html and script urls',()=>{
  const html=renderCatalogMarkdown('# Title\n\n![Screenshot](https://example.com/test.png)\n\n$x^2$\n\n```js\nalert(1)\n```\n\n<script>alert(1)</script>\n[x](javascript:alert(1))')
  expect(html).toMatch(/<h1[^>]*>Title/);expect(html).toContain('<img');expect(html).toContain('katex');expect(html).toContain('language-js');expect(html).not.toContain('<script>');expect(html).not.toContain('href="javascript:')
})

it('authors add multiple paths with separate names and codes and remove rows before saving',async()=>{
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',{user:{id:'author',app_metadata:{role:'user'}}});await flushPromises()
  await wrapper.findAll('button').find(b=>b.text()==='发布作品').trigger('click')
  await wrapper.get('input[maxlength="120"]').setValue('Multi game');await wrapper.get('.catalog-source').setValue('# Game')
  await wrapper.get('[aria-label="路径名称 1"]').setValue('百度网盘');await wrapper.get('[aria-label="下载链接 1"]').setValue('https://pan.baidu.com/s/a');await wrapper.get('[aria-label="提取码 1"]').setValue('1234')
  await wrapper.findAll('button').find(b=>b.text()==='添加路径').trigger('click')
  await wrapper.get('[aria-label="路径名称 2"]').setValue('夸克网盘');await wrapper.get('[aria-label="下载链接 2"]').setValue('https://pan.quark.cn/s/b')
  await wrapper.findAll('button').find(b=>b.text()==='添加路径').trigger('click');await wrapper.get('[aria-label="移除下载路径 3"]').trigger('click')
  catalogRequest.mockImplementation(async(path,opts)=>opts?.method==='POST'?{id:'new',status:'pending'}:{id:'new',title:'Multi game',content:'# Game',assets:[],download_links:[],status:'pending'})
  await wrapper.get('.catalog-editor').trigger('submit');await flushPromises()
  expect(catalogRequest).toHaveBeenCalledWith('',expect.objectContaining({body:expect.objectContaining({download_links:[{label:'百度网盘',url:'https://pan.baidu.com/s/a',extraction_code:'1234'},{label:'夸克网盘',url:'https://pan.quark.cn/s/b',extraction_code:''}]})}))
})

it('shows every external path alongside its URL and extraction code in detail',async()=>{
  history.replaceState(null,'','/games-tools/?id=multi')
  catalogRequest.mockImplementation(async path=>path==='/multi'?{id:'multi',title:'Multi game',content:'# Game',assets:[],status:'published',download_links:[{id:'one',label:'百度网盘',url:'https://pan.baidu.com/s/a',extraction_code:'1234'},{id:'two',label:'夸克网盘',url:'https://pan.quark.cn/s/b',extraction_code:'5678'}]}:{items:[],has_more:false})
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',null);await flushPromises()
  expect(wrapper.findAll('.catalog-external-download')).toHaveLength(2)
  expect(wrapper.get('.catalog-downloads').text()).toContain('1234');expect(wrapper.get('.catalog-downloads').text()).toContain('5678')
  expect(wrapper.get('.catalog-downloads').text()).toContain('https://pan.quark.cn/s/b')
})

it('rejects partially entered paths and caps additions at ten',async()=>{
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',{user:{id:'author',app_metadata:{role:'user'}}});await flushPromises()
  await wrapper.findAll('button').find(b=>b.text()==='发布作品').trigger('click')
  await wrapper.get('input[maxlength="120"]').setValue('Game');await wrapper.get('.catalog-source').setValue('# Game');await wrapper.get('[aria-label="路径名称 1"]').setValue('Missing URL')
  await wrapper.get('.catalog-editor').trigger('submit');await flushPromises();expect(wrapper.get('[role=alert]').text()).toContain('请为每条下载路径填写链接')
  expect(catalogRequest.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false)
  const add=wrapper.findAll('button').find(b=>b.text()==='添加路径')
  for(let i=1;i<10;i++)await add.trigger('click')
  expect(add.attributes('disabled')).toBeDefined();expect(wrapper.findAll('.catalog-link-fields')).toHaveLength(10)
})

it('admins can choose a publisher and the saved work belongs to that member',async()=>{
  catalogRequest.mockImplementation(async(path,options)=>path.startsWith('/publishers?')?{items:[{id:'member',username:'member-name',full_name:'社员甲'}],has_more:false}:options?.method==='POST'?{id:'delegated',status:'published'}:path==='/delegated'?{id:'delegated',title:'Member game',content:'# Game',assets:[],author_id:'member',username:'member-name',status:'published',kind:'game'}:{items:[],has_more:false})
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',{user:{id:'admin',app_metadata:{role:'admin'}}});await flushPromises()
  await wrapper.findAll('button').find(b=>b.text()==='发布作品').trigger('click');await flushPromises()
  expect(wrapper.get('[aria-label="发布用户"]').element.value).toBe('admin')
  await wrapper.get('[aria-label="发布用户"]').setValue('member')
  await wrapper.find('input[maxlength="120"]').setValue('Member game');await wrapper.get('.catalog-source').setValue('# Game')
  await wrapper.get('.catalog-editor').trigger('submit');await flushPromises()
  expect(catalogRequest).toHaveBeenCalledWith('',expect.objectContaining({method:'POST',body:expect.objectContaining({author_id:'member',status:'published'})}))
  expect(wrapper.text()).toContain('member-name');expect(wrapper.text()).toContain('作品已发布')
})

it('publisher lookup errors allow retry and preserve the chosen user across searches',async()=>{
  let fail=true
  catalogRequest.mockImplementation(async path=>{if(path.startsWith('/publishers?')){if(fail)throw new Error('用户列表加载失败');return {items:path.includes('other')?[]:[{id:'member',username:'Member'}],has_more:false}}return {items:[],has_more:false}})
  wrapper=mount(CatalogCenter);sessionCallback('INITIAL_SESSION',{user:{id:'admin',app_metadata:{role:'admin'}}});await flushPromises()
  await wrapper.findAll('button').find(b=>b.text()==='发布作品').trigger('click');await flushPromises()
  expect(wrapper.get('.catalog-publisher [role=alert]').text()).toContain('用户列表加载失败')
  fail=false;await wrapper.get('.catalog-publisher [role=alert] button').trigger('click');await flushPromises()
  await wrapper.get('[aria-label="发布用户"]').setValue('member')
  await wrapper.get('input[aria-label="搜索发布用户"]').setValue('other');await wrapper.get('button[aria-label="搜索发布用户"]').trigger('click');await flushPromises()
  expect(wrapper.get('[aria-label="发布用户"]').element.value).toBe('member');expect(wrapper.get('[aria-label="发布用户"]').text()).toContain('Member')
})
