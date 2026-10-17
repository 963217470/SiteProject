import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ArticleReview from '../docs/.vitepress/theme/components/ArticleReview.vue'
import { communityRequest } from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',()=>({communityRequest:vi.fn()}))
let wrapper, role, rows, detail, writes, authCallback
const originalShow=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal'), originalClose=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close')
beforeEach(()=>{
  role='admin';writes=[]
  rows=[{id:'one',title:'RD STUDIO 使用指南：阅读、分享与参与',summary:'A long review summary',status:'pending',visibility:'public',created_at:'2026-10-17T00:00:00Z',updated_at:'2026-10-17T01:00:00Z'}]
  detail={...rows[0],content:'# Full note\n\n**Complete content**\n\n![Screenshot](/test.png)\n\n$x^2$\n\n```js\nconsole.log(1)\n```'}
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:vi.fn(function(){this.setAttribute('open','')})})
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:vi.fn(function(){this.removeAttribute('open')})})
  vi.spyOn(window,'confirm').mockReturnValue(true)
  vi.spyOn(window,'prompt').mockReturnValue('Needs detail')
  window.__api={auth:{onAuthStateChange:callback=>{authCallback=callback;return{data:{subscription:{unsubscribe:vi.fn()}}}}}}
  vi.stubGlobal('fetch',vi.fn(async url=>{
    const params=new URL(url,'http://localhost').searchParams
    const selected=params.get('status')?.slice(3)
    const filtered=rows.filter(row=>!selected||row.status===selected)
    const start=Number(params.get('offset')||0),limit=Number(params.get('limit'))
    return{ok:true,json:async()=>filtered.slice(start,start+limit),headers:{get:()=>`0-0/${filtered.length}`}}
  }))
  communityRequest.mockReset().mockImplementation(async(path,options)=>{
    if(path==='/auth/session')return{session:role?{user:{id:'admin',app_metadata:{role}}}:null}
    if(options?.method){writes.push({path,options});rows=rows.filter(row=>row.id!==detail.id);return[{id:detail.id}]}
    return[detail]
  })
})
afterEach(()=>{wrapper?.unmount();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';delete window.__api;for(const [name,descriptor] of [['showModal',originalShow],['close',originalClose]]){if(descriptor)Object.defineProperty(HTMLDialogElement.prototype,name,descriptor);else delete HTMLDialogElement.prototype[name]}})
async function open(){wrapper=mount(ArticleReview,{attachTo:document.body});await flushPromises()}

it('uses isolated entry classes, truthful totals and inline preview with full Markdown and image/formula/code rendering',async()=>{
  await open()
  expect(wrapper.find('.review-entry').exists()).toBe(true)
  expect(wrapper.find('.article-card').exists()).toBe(false)
  await wrapper.get('.review-title').trigger('click');await flushPromises()
  expect(wrapper.get('dialog').attributes('open')).toBeDefined()
  expect(wrapper.get('[aria-label="审核正文"]').text()).toContain('Complete content')
  expect(wrapper.find('[aria-label="审核正文"] img').attributes('src')).toBe('/test.png')
  expect(wrapper.find('.katex').exists()).toBe(true)
  expect(wrapper.find('pre code').text()).toContain('console.log(1)')
  expect(writes).toHaveLength(0)
  await wrapper.findAll('button').find(button=>button.text()==='Markdown 原文').trigger('click')
  expect(wrapper.get('.review-source').element.value).toBe(detail.content)
})

it('reopens and refreshes preview contents instead of relying on blocked popup windows or cached article pages',async()=>{
  await open()
  await wrapper.findAll('button').find(button=>button.text()==='查看正文').trigger('click');await flushPromises()
  await wrapper.get('[aria-label="关闭预览"]').trigger('click')
  detail={...detail,title:'Updated title',content:'# Updated body'}
  await wrapper.get('.review-title').trigger('click');await flushPromises()
  expect(wrapper.get('[aria-label="审核正文"]').text()).toContain('Updated body')
  expect(wrapper.get('#review-preview-title').text()).toBe('Updated title')
})

it('approves only after confirmation and binds changes to the reviewed status and revision timestamp',async()=>{
  await open()
  await wrapper.get('.review-title').trigger('click');await flushPromises()
  await wrapper.findAll('button').find(button=>button.text()==='通过并发布').trigger('click');await flushPromises()
  expect(writes).toHaveLength(1)
  const params=new URL('http://localhost'+writes[0].path).searchParams
  expect(params.get('status')).toBe('eq.pending')
  expect(params.get('updated_at')).toBe('eq.2026-10-17T01:00:00Z')
  expect(writes[0].options.body.status).toBe('published')
  expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
})

it('keeps failed previews retryable and does not expose destructive actions to non-admin accounts',async()=>{
  await open()
  communityRequest.mockRejectedValueOnce(new Error('Preview unavailable'))
  await wrapper.get('.review-title').trigger('click');await flushPromises()
  expect(wrapper.get('dialog [role="alert"]').text()).toContain('Preview unavailable')
  await wrapper.get('dialog [role="alert"] button').trigger('click');await flushPromises()
  expect(wrapper.get('[aria-label="审核正文"]').text()).toContain('Complete content')
  role='user';authCallback('SIGNED_IN');await flushPromises()
  expect(wrapper.text()).toContain('需要管理员权限')
  expect(wrapper.find('.review-entry').exists()).toBe(false)
  expect(wrapper.find('[aria-label="审核正文"]').exists()).toBe(false)
})

it('paginates the queue while keeping server totals accurate',async()=>{
  rows=Array.from({length:32},(_,index)=>({...rows[0],id:'item-'+index,title:'Pending '+index}))
  await open()
  expect(wrapper.findAll('.review-entry')).toHaveLength(30)
  expect(wrapper.findAll('.review-metrics strong').map(el=>el.text())).toEqual(['32','0','0','32'])
  await wrapper.findAll('button').find(button=>button.text()==='下一页').trigger('click');await flushPromises()
  expect(wrapper.findAll('.review-entry')).toHaveLength(2)
  expect(wrapper.get('.review-pagination').text()).toContain('第 2 页')
})

it('keeps the reviewed content visible if a stale approval updates no rows',async()=>{
  await open()
  await wrapper.get('.review-title').trigger('click');await flushPromises()
  communityRequest.mockResolvedValueOnce([])
  await wrapper.findAll('button').find(button=>button.text()==='通过并发布').trigger('click');await flushPromises()
  expect(wrapper.get('dialog').attributes('open')).toBeDefined()
  expect(wrapper.get('dialog [role="alert"]').text()).toContain('文章已被修改或处理')
  expect(wrapper.get('[aria-label="审核正文"]').text()).toContain('Complete content')
})
