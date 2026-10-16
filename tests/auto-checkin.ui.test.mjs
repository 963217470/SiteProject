import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import CheckinDialog from '../docs/.vitepress/theme/components/CheckinDialog.vue'
import {communityRequest} from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',()=>({communityRequest:vi.fn()}))
let view,authCallback,clock
const day=86400000
beforeEach(()=>{
  communityRequest.mockReset();clock=0;vi.spyOn(performance,'now').mockImplementation(()=>clock)
  vi.spyOn(document,'hidden','get').mockReturnValue(false)
  window.__api={auth:{getSession:async()=>({data:{session:{user:{id:'me'}}}}),onAuthStateChange:callback=>{authCallback=callback;return{data:{subscription:{unsubscribe:vi.fn()}}}}}}
  HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false}
})
afterEach(()=>{view?.unmount();delete window.__api;vi.restoreAllMocks();document.body.innerHTML=''})
const posts=()=>communityRequest.mock.calls.filter(([,o])=>o?.method==='POST')
it('automatically signs on first entry, shows the reward once and checks again after the next Beijing reset',async()=>{
  communityRequest.mockImplementation(async path=>path==='/community/daily'?{checked_in:false,server_time:clock,reset_at:day}: {streak:clock?2:1,reward:5,already:false,server_time:clock,reset_at:clock?2*day:day})
  view=mount(CheckinDialog,{attachTo:document.body});await flushPromises()
  expect(posts()).toHaveLength(1);expect(view.get('dialog').element.open).toBe(true);expect(view.text()).toContain('+5 EXP')
  document.dispatchEvent(new Event('pointerdown'));window.dispatchEvent(new Event('focus'));await flushPromises();expect(posts()).toHaveLength(1)
  view.get('dialog').element.close();clock=day+1
  window.dispatchEvent(new Event('focus'));await flushPromises()
  expect(posts()).toHaveLength(2);expect(view.get('.checkin-number').text()).toBe('2')
})
it('does not sign or show a repeated popup if already checked in elsewhere',async()=>{
  communityRequest.mockResolvedValue({checked_in:true,server_time:0,reset_at:day})
  view=mount(CheckinDialog,{attachTo:document.body});await flushPromises()
  expect(posts()).toHaveLength(0);expect(view.get('dialog').element.open).toBe(false)
})
it('does not show a second reward when another device signs between the check and the write',async()=>{
  communityRequest.mockImplementation(async path=>path==='/community/daily'?{checked_in:false}:{streak:3,reward:0,already:true,server_time:0,reset_at:day})
  view=mount(CheckinDialog,{attachTo:document.body});await flushPromises()
  expect(posts()).toHaveLength(1);expect(view.get('dialog').element.open).toBe(false)
})
it('leaves visitors anonymous and does not issue reward requests',async()=>{
  window.__api.auth.getSession=async()=>({data:{session:null}})
  view=mount(CheckinDialog);await flushPromises();expect(communityRequest).not.toHaveBeenCalled()
})
it('discards an in-flight daily check after logout',async()=>{
  let finish;communityRequest.mockReturnValue(new Promise(resolve=>{finish=resolve}))
  view=mount(CheckinDialog,{attachTo:document.body});await flushPromises()
  authCallback('SIGNED_OUT',null);finish({checked_in:false});await flushPromises()
  expect(posts()).toHaveLength(0);expect(view.get('dialog').element.open).toBe(false)
})
it('a failed automatic request stays quiet and leaves manual checkin available',async()=>{
  communityRequest.mockRejectedValue(new Error('Offline'))
  view=mount(CheckinDialog,{attachTo:document.body});await flushPromises();expect(view.get('dialog').element.open).toBe(false)
  communityRequest.mockResolvedValue({streak:1,reward:5,already:false})
  window.dispatchEvent(new CustomEvent('rd:checkin'));await flushPromises()
  expect(view.text()).toContain('+5 EXP');expect(view.get('dialog').element.open).toBe(true)
})
it('a slow automatic check cannot overwrite a successful manual reward',async()=>{
  let finish;communityRequest.mockImplementation(path=>path==='/community/daily'?new Promise(resolve=>{finish=resolve}):Promise.resolve({streak:1,reward:5,already:false,server_time:0,reset_at:day}))
  view=mount(CheckinDialog,{attachTo:document.body});await flushPromises()
  window.dispatchEvent(new CustomEvent('rd:checkin'));await flushPromises()
  finish({checked_in:false});await flushPromises()
  expect(posts()).toHaveLength(1);expect(view.text()).toContain('+5 EXP')
})
