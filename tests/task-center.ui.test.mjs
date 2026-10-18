import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TaskCenter from '../docs/.vitepress/theme/components/TaskCenter.vue'
import { taskRequest } from '../docs/.vitepress/theme/lib/task-api.mjs'
import { parseTaskTime, formatTaskTime } from '../docs/.vitepress/theme/lib/task-schedule.mjs'
vi.mock('../docs/.vitepress/theme/lib/task-api.mjs',()=>({taskRequest:vi.fn(),uploadTaskEvidence:vi.fn(),removeTaskEvidence:vi.fn()}))
let wrapper, identity, items, fail
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false}
  identity={id:'me',role:'member',xp:0,level:{title:'见习社员',threshold:0},next_level:{title:'正式社员',threshold:100},identity:{},disciplines:[{id:'programming',name:'程序'}],levels:[{title:'见习社员',threshold:0}],ledger:[]}
  items=[{id:'one',title:'读两篇帖子',description:'阅读任务',type:'read',target:2,reward:100,status:'active',requirements:{},progress:0,enrollment:null}]
  fail=null
  taskRequest.mockReset().mockImplementation(async(path,options)=>{
    if(fail)throw fail
    if(path==='/me')return identity
    if(path.startsWith('?'))return {items,has_more:false}
    if(path.startsWith('/reviews'))return {items:[],rewards:[],has_more:false}
    if(path==='/one/join'){items[0].enrollment={state:'joined'};return {ok:true}}
    if(path==='/one/claim'){items[0].enrollment.state='completed';identity.xp=100;return {ok:true}}
    if(path==='/identity'){identity.identity.discipline_id=options.body.discipline_id;return {ok:true}}
    return {ok:true}
  })
})
afterEach(()=>{wrapper?.unmount();delete window.__api})
async function render(props={}){wrapper=mount(TaskCenter,{props});await flushPromises()}
describe('Task center',()=>{
  it('isolates anonymous access with a login state',async()=>{fail=Object.assign(new Error('请先登录'),{status:401});await render();expect(wrapper.text()).toContain('登录后查看任务');expect(wrapper.find('.task-list').exists()).toBe(false)})
  it('retries an unavailable service without rendering false progress',async()=>{fail=new Error('Offline');await render();expect(wrapper.get('[role="alert"]').text()).toContain('Offline');fail=null;await wrapper.get('.rd-state button').trigger('click');await flushPromises();expect(wrapper.text()).toContain('读两篇帖子')})
  it('joins, gates rewards on progress and completes a task',async()=>{await render();await wrapper.findAll('button').find(b=>b.text()==='领取任务').trigger('click');await flushPromises();let claim=wrapper.findAll('button').find(b=>b.text()==='领取奖励');expect(claim.attributes('disabled')).toBeDefined();items[0].progress=2;await wrapper.get('[aria-label="刷新进度"]').trigger('click');await flushPromises();claim=wrapper.findAll('button').find(b=>b.text()==='领取奖励');await claim.trigger('click');await flushPromises();expect(wrapper.text()).toContain('已完成');expect(wrapper.text()).toContain('100 EXP')})
  it('saves discipline without sending permission or XP fields',async()=>{await render();await wrapper.get('.task-identity select').setValue('programming');await flushPromises();expect(taskRequest).toHaveBeenCalledWith('/identity',{method:'PUT',body:{discipline_id:'programming'}})})
  it('does not expose administrator controls to members',async()=>{await render({adminView:true});expect(wrapper.text()).toContain('需要管理员权限');expect(wrapper.find('.task-create').exists()).toBe(false)})
  it('creates a draft with an administrator task template',async()=>{identity.role='admin';await render({adminView:true});await wrapper.get('.task-create input').setValue('发布三篇文章');await wrapper.get('.task-create').trigger('submit');await flushPromises();expect(taskRequest).toHaveBeenCalledWith('',expect.objectContaining({method:'POST',body:expect.objectContaining({title:'发布三篇文章',type:'publish',target:1,reward:100,deadline:null})}));expect(wrapper.text()).toContain('任务草稿已保存')})
  it('creates a scheduled task using an explicit Beijing timestamp and keeps draft as the default',async()=>{
    identity.role='admin';await render({adminView:true});expect(wrapper.find('.task-create').text()).toContain('保存草稿')
    await wrapper.get('.task-create input').setValue('Future task')
    await wrapper.findAll('.task-create label').find(l=>l.text().startsWith('发布方式')).get('select').setValue('scheduled')
    await wrapper.findAll('.task-create input[type="datetime-local"]')[1].setValue('2099-01-01T09:30')
    await wrapper.get('.task-create').trigger('submit');await flushPromises()
    expect(taskRequest).toHaveBeenCalledWith('',expect.objectContaining({method:'POST',body:expect.objectContaining({publish_at:parseTaskTime('2099-01-01T09:30'),deadline:null})}));expect(wrapper.text()).toContain('定时任务已安排')
  })
  it('rejects a publication time after the deadline without sending a creation request',async()=>{
    identity.role='admin';await render({adminView:true});taskRequest.mockClear()
    await wrapper.findAll('.task-create label').find(l=>l.text().startsWith('发布方式')).get('select').setValue('scheduled')
    await wrapper.findAll('.task-create input[type="datetime-local"]')[0].setValue('2099-01-01T09:00')
    await wrapper.findAll('.task-create input[type="datetime-local"]')[1].setValue('2099-01-01T09:30')
    await wrapper.get('.task-create').trigger('submit');await flushPromises();expect(wrapper.text()).toContain('发布时间必须在未来且早于截止时间');expect(taskRequest).not.toHaveBeenCalled()
  })
  it('edits and cancels an existing schedule with stale-setting protection',async()=>{
    identity.role='admin';items[0].status='draft';items[0].publish_at=parseTaskTime('2099-01-01T09:30');await render({adminView:true})
    expect(wrapper.get('.task-list').text()).toContain('待定时发布')
    await wrapper.findAll('.task-list button').find(b=>b.text()==='修改时间').trigger('click');expect(wrapper.get('dialog[open] input').element.value).toBe('2099-01-01T09:30')
    await wrapper.get('dialog[open] input').setValue('2099-01-01T10:30');await wrapper.get('dialog[open] form').trigger('submit');await flushPromises()
    expect(taskRequest).toHaveBeenCalledWith('/one/schedule',{method:'PATCH',body:{publish_at:parseTaskTime('2099-01-01T10:30'),expected_publish_at:items[0].publish_at}})
    await wrapper.findAll('.task-list button').find(b=>b.text()==='取消定时').trigger('click');await flushPromises()
    expect(taskRequest).toHaveBeenCalledWith('/one/schedule',{method:'PATCH',body:{publish_at:null,expected_publish_at:items[0].publish_at}})
  })
  it('keeps schedule conflicts visible inside the open dialog',async()=>{
    identity.role='admin';items[0].status='draft';items[0].publish_at=parseTaskTime('2099-01-01T09:30');await render({adminView:true})
    await wrapper.findAll('.task-list button').find(b=>b.text()==='修改时间').trigger('click')
    fail=new Error('定时设置已变化，请刷新任务后重试');await wrapper.get('dialog[open] form').trigger('submit');await flushPromises()
    expect(wrapper.get('dialog[open] [role=alert]').text()).toContain('定时设置已变化')
  })
  it('parses Beijing times independently of local timezone and rejects calendar normalization',()=>{
    expect(parseTaskTime('2030-01-01T09:30')).toBe(Date.UTC(2030,0,1,1,30));expect(formatTaskTime(Date.UTC(2030,0,1,1,30))).toBe('2030-01-01T09:30')
    expect(Number.isNaN(parseTaskTime('2030-02-30T09:30'))).toBe(true);expect(Number.isNaN(parseTaskTime('invalid'))).toBe(true);expect(parseTaskTime('')).toBe(null)
  })
})
