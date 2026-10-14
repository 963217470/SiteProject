import {readFileSync} from 'node:fs'
import {afterEach,expect,it,vi} from 'vitest'
import {flushPromises} from '@vue/test-utils'
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();document.body.innerHTML='';history.replaceState({},'','/');delete window.setProfileTab;delete window.saveProfileSettings})
it('opens another member without login and shows no private controls or email',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','setInterval','clearInterval']})
  history.replaceState({},'','/user/profile?id=creator&tab=settings')
  document.body.innerHTML='<div id="profile-page"></div>'
  const fetch=vi.fn(async()=>({ok:true,json:async()=>({profile:{id:'creator',username:'创作者',avatar_url:'/api/files/avatars/creator/avatar.png',bio:'游戏创作',role:'user'},stats:{articles:1,likes:2},articles:[{id:'a',title:'公开文章',summary:'介绍'}],has_more:false})}))
  vi.stubGlobal('fetch',fetch)
  window.eval(readFileSync('docs/public/profile-page.js','utf8'))
  document.dispatchEvent(new Event('DOMContentLoaded'));await vi.advanceTimersByTimeAsync(1);await flushPromises()
  expect(document.getElementById('profile-name').textContent).toBe('创作者')
  expect(document.getElementById('profile-avatar').getAttribute('src')).toContain('/avatars/creator/')
  expect(document.querySelector('.profile-sidebar').style.display).toBe('none')
  expect(document.getElementById('panel-articles').textContent).toContain('公开文章')
  expect(document.getElementById('panel-articles').textContent).not.toContain('编辑')
  expect(document.getElementById('profile-email').textContent).toBe('')
  expect(document.getElementById('not-logged-in').style.display).toBe('none')
  expect(fetch).toHaveBeenCalledTimes(1)
})
