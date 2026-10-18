import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ProfileCatalogPanel from '../docs/.vitepress/theme/components/ProfileCatalogPanel.vue'
import { catalogRequest } from '../docs/.vitepress/theme/lib/catalog-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/catalog-api.mjs',()=>({catalogRequest:vi.fn()}))
let wrapper,callback,items
const panel=()=>document.querySelector('#panel-catalog')
const click=async element=>{element.click();await flushPromises()}
beforeEach(()=>{
  history.replaceState({},'','/user/profile?tab=catalog')
  document.body.innerHTML='<div id="profile-app" style="display:block"><div id="panel-catalog" style="display:block"></div></div>'
  window.__api={auth:{onAuthStateChange:cb=>{callback=cb;return {data:{subscription:{unsubscribe:vi.fn()}}}}}}
  items=[{id:'mine',author_id:'author',title:'My game',kind:'game',status:'published',revision:3,summary:'Description',downloads:7,updated_at:'2026-10-18T01:00:00Z',cover_url:'/images/test.png'}]
  catalogRequest.mockReset().mockImplementation(async(path,options)=>{
    if(options?.method==='POST'){items=[{...items[0],status:'draft',revision:4}];return {id:'mine',status:'draft'}}
    return {items,has_more:false}
  })
})
afterEach(()=>{wrapper?.unmount();wrapper=null;delete window.__api;vi.unstubAllGlobals();document.body.innerHTML='';history.replaceState({},'','/')})
async function open(){wrapper=mount(ProfileCatalogPanel,{attachTo:document.body});callback('INITIAL_SESSION',{user:{id:'author'}});await flushPromises()}
it('loads only owned works and exposes view, editor, new work and status',async()=>{
  await open();expect(catalogRequest).toHaveBeenCalledWith('?scope=mine&kind=&q=&offset=0')
  expect(panel().textContent).toContain('已发布');expect(panel().textContent).toContain('下载访问 7')
  expect(panel().querySelector('a[href="/games-tools/?id=mine&edit=1"]')).not.toBeNull()
  expect(panel().querySelector('a[href="/games-tools/?create=1"]')).not.toBeNull()
  const image=panel().querySelector('img');image.dispatchEvent(new Event('error'));await flushPromises();expect(panel().querySelector('img')).toBeNull()
})
it('withdrawal requires confirmation and sends the current revision before reloading the draft',async()=>{
  await open();const confirm=vi.fn(()=>false);vi.stubGlobal('confirm',confirm)
  const withdraw=Array.from(panel().querySelectorAll('button')).find(button=>button.textContent.includes('撤回'))
  await click(withdraw);expect(catalogRequest.mock.calls.some(([,options])=>options)).toBe(false)
  confirm.mockReturnValue(true);await click(withdraw)
  expect(catalogRequest).toHaveBeenCalledWith('/mine/withdraw',{method:'POST',body:{revision:3}})
  expect(panel().textContent).toContain('作品已撤回为草稿');expect(panel().querySelector('.profile-catalog-status').textContent).toBe('草稿')
  expect(Array.from(panel().querySelectorAll('button')).some(button=>button.textContent==='撤回')).toBe(false)
})
it('filters owned games or tools and isolates retryable errors',async()=>{
  await open();const select=panel().querySelector('select');select.value='tool';select.dispatchEvent(new Event('change'));await flushPromises()
  expect(catalogRequest).toHaveBeenLastCalledWith('?scope=mine&kind=tool&q=&offset=0')
  catalogRequest.mockRejectedValueOnce(new Error('Offline'));panel().querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flushPromises()
  expect(panel().querySelector('[role=alert]').textContent).toContain('Offline')
  await click(panel().querySelector('[role=alert] button'));expect(panel().querySelector('[role=alert]')).toBeNull()
})
it('drops old responses on account changes and never mounts in another member public page',async()=>{
  let resolve;catalogRequest.mockImplementationOnce(()=>new Promise(done=>{resolve=done}))
  wrapper=mount(ProfileCatalogPanel,{attachTo:document.body});callback('INITIAL_SESSION',{user:{id:'author'}})
  callback('SIGNED_OUT',null);resolve({items,has_more:false});await flushPromises()
  expect(panel().textContent).not.toContain('My game');expect(panel().textContent).toContain('请先登录')
  history.replaceState({},'','/user/profile?id=other&tab=catalog');window.dispatchEvent(new CustomEvent('rd:profile-tab'));await flushPromises()
  expect(panel().querySelector('.profile-catalog')).toBeNull()
})
