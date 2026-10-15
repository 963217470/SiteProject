import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import AdminDashboard from '../docs/.vitepress/theme/components/AdminDashboard.vue'
import {communityRequest} from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',()=>({communityRequest:vi.fn()}))
let view
const overview={pending:2,users:3,published:4,queues:[{kind:'article',label:'文章',count:2,href:'/admin/articles'}]}
beforeEach(()=>{communityRequest.mockReset();window.__api={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}};HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false}})
afterEach(()=>{view?.unmount();delete window.__api;document.body.innerHTML=''})
it('loads real queue counts and sends filters to the server without rendering submitted HTML',async()=>{
  communityRequest.mockImplementation(async path=>path==='/admin/overview'?overview:{items:[{kind:'article',id:'a',title:'<script>test</script>',username:'作者',user_id:'u',href:'/admin/articles'}],has_more:false})
  view=mount(AdminDashboard);await flushPromises()
  expect(view.text()).toContain('待处理申请');expect(view.find('script').exists()).toBe(false)
  expect(view.text()).toContain('<script>test</script>')
  await view.get('select').setValue('article');await flushPromises()
  expect(communityRequest.mock.calls.some(([p])=>p.includes('kind=article'))).toBe(true)
})
it('requires a preview and confirmation before sending and keeps a stable key on retry',async()=>{
  communityRequest.mockImplementation(async(path,options)=>path==='/admin/overview'?overview:path.startsWith('/admin/queue')?{items:[],has_more:false}:path==='/admin/notice-preview'?{recipient_count:3}:Promise.reject(new Error('暂时无法连接')))
  view=mount(AdminDashboard,{attachTo:document.body});await flushPromises()
  await view.findAll('button').find(b=>b.text()==='发送通知').trigger('click')
  const fields=view.findAll('input');await fields[0].setValue('标题');await view.get('textarea').setValue('通知内容')
  await view.get('.admin-notice-form').trigger('submit');await flushPromises()
  expect(view.get('dialog').element.open).toBe(true)
  expect(communityRequest.mock.calls.some(([p])=>p==='/admin/notices')).toBe(false)
  const confirm=view.findAll('button').find(b=>b.text()==='确认发送')
  await confirm.trigger('click');await flushPromises();await confirm.trigger('click');await flushPromises()
  const calls=communityRequest.mock.calls.filter(([p])=>p==='/admin/notices')
  expect(calls.length).toBe(2);expect(calls[0][1].body.request_key).toBe(calls[1][1].body.request_key)
})
it('does not expose admin contents to a denied session',async()=>{
  communityRequest.mockRejectedValue(Object.assign(new Error('需要管理员权限'),{status:403}))
  view=mount(AdminDashboard);await flushPromises()
  expect(view.text()).toContain('需要管理员权限');expect(view.find('.admin-sidebar').exists()).toBe(false)
})
