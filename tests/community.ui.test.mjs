import { beforeEach,afterEach,it,expect,vi } from 'vitest'
import { mount,flushPromises } from '@vue/test-utils'
import CheckinDialog from '../docs/.vitepress/theme/components/CheckinDialog.vue'
import DailyTasks from '../docs/.vitepress/theme/components/DailyTasks.vue'
import CommentThread from '../docs/.vitepress/theme/components/CommentThread.vue'
import CommentModeration from '../docs/.vitepress/theme/components/CommentModeration.vue'
import MessageInbox from '../docs/.vitepress/theme/components/MessageInbox.vue'
import { communityRequest,rankClass } from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',async importOriginal=>({...await importOriginal(),communityRequest:vi.fn()}))
let wrapper,unsub
beforeEach(()=>{
  communityRequest.mockReset();unsub=vi.fn()
  window.__api={auth:{getSession:async()=>({data:{session:{user:{id:'me'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:unsub}}})}}
  HTMLDialogElement.prototype.showModal=function(){this.open=true}
  HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'))}
})
afterEach(()=>{wrapper?.unmount();delete window.__api;vi.restoreAllMocks();history.replaceState({},'','/');document.body.innerHTML=''})
it('opens a red-number checkin popup and disables repeated in-flight requests',async()=>{
  let resolve;communityRequest.mockReturnValue(new Promise(r=>{resolve=r}))
  wrapper=mount(CheckinDialog,{attachTo:document.body,props:{automatic:false}})
  window.dispatchEvent(new CustomEvent('rd:checkin'));window.dispatchEvent(new CustomEvent('rd:checkin'))
  expect(communityRequest).toHaveBeenCalledTimes(1)
  resolve({streak:7,reward:10,already:false});await flushPromises()
  expect(wrapper.get('.checkin-number').text()).toBe('7');expect(wrapper.text()).toContain('+10 EXP')
  expect(wrapper.get('dialog').element.open).toBe(true)
})
it('daily tasks show earned states, reading progress and unconfigured advanced task',async()=>{
  communityRequest.mockResolvedValue({day:'2026-10-10',reset_at:Date.now()+86400000,advanced_unlocked:true,reading_seconds:135,tasks:[{kind:'checkin',title:'签到',reward:5,done:true},{kind:'read',title:'浏览一篇文章 150 秒',reward:5,done:false}]})
  wrapper=mount(DailyTasks);await flushPromises()
  expect(wrapper.text()).toContain('135 / 150');expect(wrapper.text()).toContain('内容待公布');expect(wrapper.find('[aria-label="已完成"]').exists()).toBe(true)
})
it('comments render safely and submit replies as pending moderation, not local publication',async()=>{
  history.replaceState({},'','/article/?id=a')
  const comment={id:'c',username:'Writer',content:'<script>alert(1)</script>',status:'approved',created_at:new Date().toISOString()}
  communityRequest.mockImplementation(async path=>path.startsWith('/comments?')?{items:[comment],has_more:false}:{id:'new',status:'pending'})
  wrapper=mount(CommentThread,{attachTo:document.body});await flushPromises()
  expect(wrapper.find('script').exists()).toBe(false);expect(wrapper.text()).toContain('<script>')
  wrapper.get('textarea').element.scrollIntoView=vi.fn()
  await wrapper.findAll('button').find(b=>b.text()==='回复').trigger('click');await flushPromises()
  await wrapper.get('textarea').setValue('My reply');await wrapper.get('form').trigger('submit');await flushPromises()
  expect(communityRequest).toHaveBeenCalledWith('/comments',{method:'POST',body:{article_id:'a',parent_id:'c',content:'My reply'}})
  expect(wrapper.text()).toContain('审核通过后公开展示')
})
it('moderation requires rejection note and allows approving pending comments',async()=>{
  communityRequest.mockResolvedValue({items:[{id:'c',username:'Writer',title:'Post',content:'Hi',status:'pending'}],has_more:false})
  wrapper=mount(CommentModeration);await flushPromises()
  await wrapper.findAll('button').find(b=>b.text()==='拒绝').trigger('click')
  expect(wrapper.text()).toContain('填写拒绝');expect(communityRequest).toHaveBeenCalledTimes(1)
  await wrapper.get('textarea').setValue('Reason');await wrapper.findAll('button').find(b=>b.text()==='拒绝').trigger('click');await flushPromises()
  expect(communityRequest).toHaveBeenCalledWith('/comments/c/review',{method:'POST',body:{approved:false,note:'Reason'}})
})
it('message read operations send only notification ID and refresh unread state',async()=>{
  communityRequest.mockImplementation(async(path,options)=>options?{ok:true}:{items:[{id:'n',title:'升级',body:'50 EXP',href:'/tasks/',created_at:Date.now(),read_at:null}],unread:1,has_more:false})
  wrapper=mount(MessageInbox);await flushPromises()
  await wrapper.get('[aria-label="标记已读"]').trigger('click');await flushPromises()
  expect(communityRequest).toHaveBeenCalledWith('/messages/read',{method:'POST',body:{id:'n'}})
})
it('rank colors include white newcomer and independent red presidency',()=>{
  expect(rankClass({title:'新人'})).toBe('rank-new')
  expect(rankClass({title:'见习社员'})).toBe('rank-apprentice')
  expect(rankClass({title:'正式社员'})).toBe('rank-member')
  expect(rankClass({title:'资深社员'})).toBe('rank-senior')
  expect(rankClass({title:'新人'},'president')).toBe('rank-president')
})
it('message categories reset pagination and archive requests only contain the selected ID',async()=>{
  communityRequest.mockImplementation(async(path,options)=>options?{ok:true}:{items:[{id:'n',title:'通知',body:'Body',href:'javascript:alert(1)',created_at:1,category:'announcement'}],unread:1,has_more:false,sync_at:100})
  wrapper=mount(MessageInbox);await flushPromises()
  expect(wrapper.find('.notification-row a').attributes('href')).toBe('/messages/')
  await wrapper.findAll('button').find(b=>b.text()==='站内通知').trigger('click');await flushPromises()
  expect(communityRequest.mock.calls.some(([p])=>p.includes('category=announcement'))).toBe(true)
  await wrapper.get('[aria-label="归档消息"]').trigger('click');await flushPromises()
  expect(communityRequest).toHaveBeenCalledWith('/messages/n/archive',{method:'POST',body:{}})
})
