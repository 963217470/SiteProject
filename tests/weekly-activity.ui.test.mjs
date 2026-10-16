import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import WeeklyActivity from '../docs/.vitepress/theme/components/WeeklyActivity.vue'
import {communityRequest} from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',()=>({communityRequest:vi.fn()}))
let view
beforeEach(()=>{communityRequest.mockReset();history.replaceState({},'','/activity/');window.__api={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}}})
afterEach(()=>{view?.unmount();delete window.__api;history.replaceState({},'','/')})
const result={week_start:'2026-10-12',week_end:'2026-10-18',is_current:true,total:2,previous_week:'2026-10-05',next_week:null,has_more:false,own:{weekly_exp:5,rank:1},items:[{id:'u',username:'真实成员',weekly_exp:5,rank:1}]}
it('renders weekly EXP and real profile links, not total lifetime experience',async()=>{
  communityRequest.mockResolvedValue(result);view=mount(WeeklyActivity);await flushPromises()
  expect(view.text()).toContain('2026-10-12 - 2026-10-18');expect(view.text()).toContain('+5')
  expect(view.get('.weekly-list a').attributes('href')).toBe('/user/profile?id=u')
  expect(view.get('[aria-label="下一周"]').attributes('disabled')).toBeDefined()
  await view.get('[aria-label="上一周"]').trigger('click');await flushPromises()
  expect(communityRequest.mock.calls.at(-1)[0]).toContain('week=2026-10-05')
})
it('compact home rankings request five results and link to the complete board',async()=>{
  communityRequest.mockResolvedValue(result);view=mount(WeeklyActivity,{props:{compact:true}});await flushPromises()
  expect(communityRequest.mock.calls[0][0]).toContain('limit=5');expect(view.get('[aria-label="查看完整活跃榜"]').attributes('href')).toBe('/activity/')
})
