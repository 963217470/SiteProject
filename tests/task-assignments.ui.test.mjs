import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TaskDeadlineReminder from '../docs/.vitepress/theme/components/TaskDeadlineReminder.vue'
import TaskAudiencePicker from '../docs/.vitepress/theme/components/TaskAudiencePicker.vue'
import { deadlineCountdown } from '../docs/.vitepress/theme/lib/task-deadline.mjs'
import { taskRequest } from '../docs/.vitepress/theme/lib/task-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/task-api.mjs',()=>({taskRequest:vi.fn()}))
let wrapper
afterEach(()=>{wrapper?.unmount();wrapper=null;vi.clearAllTimers();vi.useRealTimers();vi.clearAllMocks();document.body.innerHTML=''})

it('formats days/hours/minutes/seconds and clamps overdue deadlines',()=>{
  expect(deadlineCountdown(90061000,0)).toBe('01:01:01:01')
  expect(deadlineCountdown(0,1000)).toBe('00:00:00:00')
})

it('keeps a single ticking reminder, updates pending independently of messages, and clears after completion',async()=>{
  vi.useFakeTimers();vi.setSystemTime(100000)
  let data={server_now:100000,count:2,nearest:{title:'Design brief',deadline:190000,state:'joined'}}
  taskRequest.mockImplementation(async()=>({...data,server_now:Date.now()}))
  wrapper=mount(TaskDeadlineReminder,{props:{userId:'owner'},attachTo:document.body});await flushPromises()
  expect(document.querySelectorAll('.task-deadline-reminder')).toHaveLength(1)
  expect(document.body.textContent).toContain('00:00:01:30')
  await vi.advanceTimersByTimeAsync(1000)
  expect(document.body.textContent).toContain('00:00:01:29')
  window.dispatchEvent(new Event('rd:community-updated'));await flushPromises()
  expect(wrapper.emitted('pending').at(-1)).toEqual([true])
  data={server_now:Date.now(),count:0,nearest:null}
  window.dispatchEvent(new Event('rd:task-updated'));await flushPromises()
  expect(document.querySelector('.task-deadline-reminder')).toBeNull()
  expect(wrapper.emitted('pending').at(-1)).toEqual([false])
  wrapper.unmount();wrapper=null
  expect(vi.getTimerCount()).toBe(0)
})

it('shows expired assigned tasks without negative clocks and keeps pending red dot signal',async()=>{
  taskRequest.mockResolvedValue({server_now:Date.now(),count:1,nearest:{title:'Overdue',deadline:Date.now()-10000,state:'rejected'}})
  wrapper=mount(TaskDeadlineReminder,{props:{userId:'owner'},attachTo:document.body});await flushPromises()
  expect(document.body.textContent).toContain('任务已逾期')
  expect(document.body.textContent).toContain('00:00:00:00')
  expect(wrapper.emitted('pending').at(-1)).toEqual([true])
})

it('selects exact members across searches and previews the actual server recipient count',async()=>{
  taskRequest.mockImplementation(async path=>path.startsWith('/people')?[{id:'one',username:'Creator'}]:{count:1})
  wrapper=mount(TaskAudiencePicker,{props:{levels:[{threshold:50,title:'见习社员'}],disciplines:[{id:'art',name:'美术'}]}})
  await wrapper.get('select').setValue('users')
  await wrapper.findAll('button').find(b=>b.text()==='查找').trigger('click');await flushPromises()
  await wrapper.get('input[type=checkbox]').setValue(true)
  expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({kind:'users',ids:['one']})
  await wrapper.findAll('button').find(b=>b.text()==='核对人数').trigger('click');await flushPromises()
  expect(wrapper.text()).toContain('当前匹配 1 人')
  await wrapper.get('select').setValue('discipline')
  await wrapper.findAll('select')[1].setValue('art')
  expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({kind:'discipline',value:'art'})
  expect(wrapper.text()).not.toContain('当前匹配 1 人')
})
