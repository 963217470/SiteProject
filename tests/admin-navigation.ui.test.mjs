import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {nextTick} from 'vue'
import AdminNavigation from '../docs/.vitepress/theme/components/AdminNavigation.vue'
import {adminNavigation,adminSection} from '../docs/.vitepress/theme/lib/admin-navigation.mjs'
const {route}=vi.hoisted(()=>({route:{path:'/admin/'}}))
vi.mock('vitepress',()=>({useRoute:()=>route}))
let view
beforeEach(()=>history.replaceState({},'','/admin/'))
afterEach(()=>{view?.unmount();history.replaceState({},'','/');route.path='/admin/'})
it('normalizes every admin page and selects the right task subview',()=>{
  for(const item of adminNavigation)expect(adminSection(item.href)).toBe(item.id)
  expect(adminSection('/admin/index.html')).toBe('overview')
  expect(adminSection('/admin/articles.html')).toBe('articles')
  expect(adminSection('/admin/tasks?view=levels')).toBe('people')
  expect(adminSection('/games-tools/?scope=public')).toBe('')
  expect(adminSection('/articles/')).toBe('')
})
it('has the same management destinations and exactly one current link with a mobile selector',async()=>{
  history.replaceState({},'','/admin/profile-review')
  view=mount(AdminNavigation)
  await nextTick()
  expect(view.findAll('.admin-nav-links a')).toHaveLength(adminNavigation.length)
  expect(view.findAll('[aria-current="page"]')).toHaveLength(1)
  expect(view.get('[aria-current="page"]').text()).toBe('个人信息审核')
  expect(view.get('select').element.value).toBe('profiles')
  expect(view.findAll('option')).toHaveLength(adminNavigation.length)
  expect(view.findAll('.admin-nav-links a').every(a=>a.attributes('target')==='_self')).toBe(true)
})
it('updates the active destination when a task tab changes without reloading',async()=>{
  view=mount(AdminNavigation)
  history.replaceState({},'','/admin/tasks?view=reviews')
  window.dispatchEvent(new CustomEvent('rd:admin-navigation'));await nextTick()
  expect(view.get('[aria-current="page"]').text()).toBe('证明审核')
  history.replaceState({},'','/admin/tasks?view=levels')
  window.dispatchEvent(new PopStateEvent('popstate'));await nextTick()
  expect(view.get('[aria-current="page"]').text()).toBe('用户与经验')
})
it('only displays the shared navigation in management contexts',async()=>{
  history.replaceState({},'','/articles/')
  view=mount(AdminNavigation);await nextTick();expect(view.find('nav').exists()).toBe(false)
  history.replaceState({},'','/games-tools/?scope=review')
  window.dispatchEvent(new CustomEvent('rd:admin-navigation'));await nextTick()
  expect(view.get('[aria-current="page"]').text()).toBe('游戏/工具审核')
})
